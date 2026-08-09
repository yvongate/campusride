import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotationDto } from './dto/create-notation.dto';

@Injectable()
export class NotationService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifierParticipant(
    trajetId: string,
    conducteurId: string,
    userId: string,
  ) {
    if (userId === conducteurId) {
      return;
    }

    const reservation = await this.prisma.reservation.findFirst({
      where: { trajetId, passagerId: userId },
    });
    if (!reservation) {
      throw new ForbiddenException(
        'Cet utilisateur ne fait pas partie de ce trajet',
      );
    }
  }

  private async recalculerNoteMoyenne(userId: string) {
    const notations = await this.prisma.notation.findMany({
      where: { destinataireId: userId },
      select: { etoiles: true },
    });
    const moyenne =
      notations.reduce((somme, n) => somme + n.etoiles, 0) / notations.length;

    await this.prisma.utilisateur.update({
      where: { id: userId },
      data: { note: moyenne },
    });
  }

  async noterParticipant(
    noteurId: string,
    trajetId: string,
    dto: CreateNotationDto,
  ) {
    const trajet = await this.prisma.trajet.findUnique({
      where: { id: trajetId },
    });
    if (!trajet) {
      throw new NotFoundException('Trajet introuvable');
    }
    if (trajet.statut !== 'termine') {
      throw new ConflictException('Seul un trajet "termine" peut etre note');
    }
    if (dto.destinataireId === noteurId) {
      throw new BadRequestException('Impossible de se noter soi-meme');
    }

    await this.verifierParticipant(trajetId, trajet.conducteurId, noteurId);
    await this.verifierParticipant(
      trajetId,
      trajet.conducteurId,
      dto.destinataireId,
    );

    const dejaNote = await this.prisma.notation.findFirst({
      where: { trajetId, noteurId, destinataireId: dto.destinataireId },
    });
    if (dejaNote) {
      throw new ConflictException(
        'Tu as deja note ce participant pour ce trajet',
      );
    }

    const notation = await this.prisma.notation.create({
      data: {
        trajetId,
        noteurId,
        destinataireId: dto.destinataireId,
        etoiles: dto.etoiles,
        commentaire: dto.commentaire,
      },
    });

    await this.recalculerNoteMoyenne(dto.destinataireId);

    return notation;
  }

  async listerNotationsTrajet(userId: string, trajetId: string) {
    const trajet = await this.prisma.trajet.findUnique({
      where: { id: trajetId },
    });
    if (!trajet) {
      throw new NotFoundException('Trajet introuvable');
    }

    await this.verifierParticipant(trajetId, trajet.conducteurId, userId);

    return this.prisma.notation.findMany({
      where: { trajetId },
      include: {
        noteur: { select: { id: true, nom: true, prenom: true } },
        destinataire: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
