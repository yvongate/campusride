import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// Anti-spam minimal : tant que l'administration n'a pas repondu, inutile
// d'empiler les messages -- ils encombreraient le back-office sans rien
// apporter. Trois laisse la place a un ajout de precisions apres coup.
const MESSAGES_OUVERTS_MAX = 3;

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async creerMessage(userId: string, contenu: string) {
    const ouverts = await this.prisma.messageSupport.count({
      where: { userId, statut: 'ouvert' },
    });
    if (ouverts >= MESSAGES_OUVERTS_MAX) {
      throw new BadRequestException(
        'Tu as déjà des messages en attente de réponse. Patiente, on te répond bientôt.',
      );
    }

    return this.prisma.messageSupport.create({
      data: { userId, contenu },
      select: {
        id: true,
        contenu: true,
        statut: true,
        reponse: true,
        createdAt: true,
        repondueLe: true,
      },
    });
  }

  // Historique cote utilisateur : il doit pouvoir relire sa demande ET la
  // reponse, sinon une notification push manquee fait perdre l'information.
  listerMesMessages(userId: string) {
    return this.prisma.messageSupport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        contenu: true,
        statut: true,
        reponse: true,
        createdAt: true,
        repondueLe: true,
      },
    });
  }

  // Cote admin : les messages ouverts d'abord (le back-office pagine ensuite
  // cote client, comme les autres tableaux du dashboard).
  async lister() {
    const messages = await this.prisma.messageSupport.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        utilisateur: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            telephone: true,
            suspenduJusqua: true,
            actif: true,
          },
        },
      },
    });

    return messages.sort((a, b) => {
      if (a.statut === b.statut) {
        return 0;
      }
      return a.statut === 'ouvert' ? -1 : 1;
    });
  }

  async repondre(id: string, reponse: string) {
    const message = await this.prisma.messageSupport.findUnique({
      where: { id },
      select: { id: true, userId: true, statut: true },
    });
    if (!message) {
      throw new NotFoundException('Ce message est introuvable.');
    }
    if (message.statut === 'traite') {
      throw new BadRequestException('Ce message a déjà reçu une réponse.');
    }

    const messageTraite = await this.prisma.messageSupport.update({
      where: { id },
      data: { reponse, statut: 'traite', repondueLe: new Date() },
    });

    await this.notifications.envoyer(
      [message.userId],
      'Réponse du support',
      "L'équipe CampusRide a répondu à ton message.",
      { type: 'support' },
    );

    return messageTraite;
  }
}
