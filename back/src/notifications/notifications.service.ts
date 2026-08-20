import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { PrismaService } from '../prisma/prisma.service';

// Charge utile transportee par la notification : permet au mobile d'ouvrir
// directement l'ecran concerne au lieu de retomber sur l'accueil (voir
// front_mobile/src/utils/push.ts).
export interface NotificationData {
  type:
    | 'demande'
    | 'trajet'
    | 'messagerie'
    | 'notation'
    | 'compte'
    | 'support';
  // Identifiant de la ressource a ouvrir (demandeId, trajetId...). Absent
  // pour les notifications qui ne ciblent aucun ecran precis (suspension).
  id?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  // EXPO_ACCESS_TOKEN est optionnel : il n'est requis que si la "Enhanced
  // Security for Push Notifications" est activee sur le compte Expo. Sans
  // lui, l'envoi fonctionne normalement.
  private readonly expo = new Expo({
    accessToken: process.env.EXPO_ACCESS_TOKEN,
  });

  constructor(private readonly prisma: PrismaService) {}

  // Le token identifie l'APPAREIL, pas le compte : s'il est deja connu, on le
  // rattache simplement au nouveau userId (cas d'un telephone partage ou d'un
  // changement de compte) plutot que de creer un doublon.
  async enregistrerAppareil(
    userId: string,
    token: string,
    plateforme: string,
  ): Promise<void> {
    if (!Expo.isExpoPushToken(token)) {
      this.logger.warn(`Token push invalide ignore : ${token}`);
      return;
    }

    await this.prisma.appareilPush.upsert({
      where: { token },
      update: { userId, plateforme },
      create: { userId, token, plateforme },
    });
  }

  // Appele a la deconnexion. Sans ca, l'utilisateur suivant du meme telephone
  // recevrait les notifications destinees au compte precedent.
  async supprimerAppareil(token: string): Promise<void> {
    await this.prisma.appareilPush.deleteMany({ where: { token } });
  }

  // Envoi "au mieux" : cette methode ne rejette JAMAIS. Une notification est
  // un effet de bord — si le service Expo est lent ou en panne, annuler un
  // trajet ou rejoindre une demande doit quand meme aboutir. Les appelants
  // n'ont donc pas a l'entourer d'un try/catch.
  async envoyer(
    destinataires: string[],
    titre: string,
    corps: string,
    data?: NotificationData,
  ): Promise<void> {
    // Journalise toujours, meme sans appareil enregistre : c'est ce qui
    // permet de verifier le comportement en developpement sans build mobile
    // (les push sont indisponibles dans Expo Go depuis le SDK 53).
    this.logger.log(
      `notification: "${titre}" -> ${destinataires.length} destinataire(s)${data ? ` [${data.type}${data.id ? ' ' + data.id : ''}]` : ''}`,
    );

    if (destinataires.length === 0) {
      return;
    }

    try {
      const appareils = await this.prisma.appareilPush.findMany({
        where: { userId: { in: destinataires } },
        select: { token: true },
      });
      if (appareils.length === 0) {
        return;
      }

      const messages: ExpoPushMessage[] = appareils.map(({ token }) => ({
        to: token,
        sound: 'default',
        title: titre,
        body: corps,
        data: data as Record<string, unknown> | undefined,
      }));

      // chunkPushNotifications respecte la limite de 100 messages par requete
      // et sendPushNotificationsAsync applique le debit maximal autorise.
      for (const lot of this.expo.chunkPushNotifications(messages)) {
        const tickets = await this.expo.sendPushNotificationsAsync(lot);
        await this.traiterTickets(lot, tickets);
      }
    } catch (erreur) {
      this.logger.error(
        `Envoi des notifications echoue ("${titre}") : ${String(erreur)}`,
      );
    }
  }

  // "DeviceNotRegistered" signifie que l'appareil ne peut plus recevoir de
  // notification (app desinstallee, token revoque) : la doc Expo demande
  // explicitement d'arreter d'y envoyer. Sans ce nettoyage, la table
  // accumulerait des tokens morts indefiniment.
  private async traiterTickets(
    messages: ExpoPushMessage[],
    tickets: ExpoPushTicket[],
  ): Promise<void> {
    const tokensMorts: string[] = [];

    tickets.forEach((ticket, index) => {
      if (ticket.status !== 'error') {
        return;
      }
      const message = messages[index];
      const destinataire = typeof message?.to === 'string' ? message.to : null;
      if (ticket.details?.error === 'DeviceNotRegistered' && destinataire) {
        tokensMorts.push(destinataire);
        return;
      }
      this.logger.warn(
        `Notification rejetee par Expo (${ticket.details?.error ?? 'inconnu'}) : ${ticket.message}`,
      );
    });

    if (tokensMorts.length > 0) {
      await this.prisma.appareilPush.deleteMany({
        where: { token: { in: tokensMorts } },
      });
      this.logger.log(
        `${tokensMorts.length} token(s) push obsolete(s) supprime(s)`,
      );
    }
  }
}
