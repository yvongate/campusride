import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagerieService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async verifierAcces(trajetId: string, userId: string) {
    const trajet = await this.prisma.trajet.findUnique({
      where: { id: trajetId },
    });
    if (!trajet) {
      throw new NotFoundException('Ce trajet est introuvable.');
    }

    if (trajet.conducteurId === userId) {
      return trajet;
    }

    const reservation = await this.prisma.reservation.findFirst({
      where: { trajetId, passagerId: userId, statut: 'confirmee' },
    });
    if (!reservation) {
      throw new ForbiddenException("Tu n'as pas accès à la messagerie de ce trajet.");
    }

    return trajet;
  }

  async envoyerMessage(
    userId: string,
    trajetId: string,
    dto: CreateMessageDto,
  ) {
    const trajet = await this.verifierAcces(trajetId, userId);
    if (trajet.statut === 'termine') {
      throw new ConflictException(
        'La messagerie de ce trajet a été supprimée (trajet terminé).',
      );
    }

    const message = await this.prisma.message.create({
      data: {
        trajetId,
        expediteurId: userId,
        contenu: dto.contenu,
      },
    });

    // "Nouveau message dans le chat du trajet" (§9) : sans cette notification,
    // la messagerie ne servait a rien en pratique -- personne n'ouvre l'app au
    // hasard pour verifier s'il a recu un message.
    const reservations = await this.prisma.reservation.findMany({
      where: { trajetId, statut: 'confirmee' },
      select: { passagerId: true },
    });
    const destinataires = [
      trajet.conducteurId,
      ...reservations.map((r) => r.passagerId),
    ].filter((destinataireId) => destinataireId !== userId);

    const expediteur = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: { nom: true, prenom: true },
    });
    const nom = expediteur?.nom ?? expediteur?.prenom ?? 'Quelqu\'un';

    await this.notifications.envoyer(
      destinataires,
      `Message de ${nom}`,
      dto.contenu,
      { type: 'messagerie', id: trajetId },
    );

    return message;
  }

  async listerMessages(userId: string, trajetId: string) {
    await this.verifierAcces(trajetId, userId);

    return this.prisma.message.findMany({
      where: { trajetId },
      include: {
        expediteur: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async supprimerChatTrajet(trajetId: string): Promise<void> {
    await this.prisma.message.deleteMany({ where: { trajetId } });
  }
}
