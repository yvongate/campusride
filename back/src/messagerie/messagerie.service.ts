import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagerieService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifierAcces(trajetId: string, userId: string) {
    const trajet = await this.prisma.trajet.findUnique({
      where: { id: trajetId },
    });
    if (!trajet) {
      throw new NotFoundException('Trajet introuvable');
    }

    if (trajet.conducteurId === userId) {
      return trajet;
    }

    const reservation = await this.prisma.reservation.findFirst({
      where: { trajetId, passagerId: userId, statut: 'confirmee' },
    });
    if (!reservation) {
      throw new ForbiddenException("Tu n'as pas acces au chat de ce trajet");
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
        'Le chat de ce trajet a ete supprime (trajet termine)',
      );
    }

    return this.prisma.message.create({
      data: {
        trajetId,
        expediteurId: userId,
        contenu: dto.contenu,
      },
    });
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
