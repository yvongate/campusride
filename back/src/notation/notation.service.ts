import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeNote } from '../common/utils/note';
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
        'Cet utilisateur ne fait pas partie de ce trajet.',
      );
    }
  }

  private async recalculerNoteMoyenne(userId: string) {
    const notations = await this.prisma.notation.findMany({
      where: { destinataireId: userId },
      select: { etoiles: true },
    });
    const noteBrute =
      notations.length === 0
        ? null
        : notations.reduce((somme, n) => somme + n.etoiles, 0) /
          notations.length;

    // "note" derive toujours de noteBrute - penaliteCumulee (voir
    // computeNote) -- ne jamais ecrire "note: noteBrute" directement, sinon
    // on efface les penalites (absence/annulation tardive, TrajetsService)
    // accumulees depuis la derniere notation.
    const utilisateur = await this.prisma.utilisateur.findUniqueOrThrow({
      where: { id: userId },
      select: { penaliteCumulee: true },
    });

    await this.prisma.utilisateur.update({
      where: { id: userId },
      data: {
        noteBrute,
        nombreNotations: notations.length,
        note: computeNote(noteBrute, utilisateur.penaliteCumulee),
      },
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
      throw new NotFoundException('Ce trajet est introuvable.');
    }
    if (trajet.statut !== 'termine') {
      throw new ConflictException('Seul un trajet "terminé" peut être noté.');
    }
    if (dto.destinataireId === noteurId) {
      throw new BadRequestException('Tu ne peux pas te noter toi-même.');
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
        'Tu as déjà noté ce participant pour ce trajet.',
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
      throw new NotFoundException('Ce trajet est introuvable.');
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

  // Avis publics recus par un utilisateur, tous trajets confondus -- affiche
  // sur son profil (avant de reserver, ou sur son propre "Mes informations").
  // Aucune restriction d'acces au-dela d'etre connecte : la note moyenne est
  // deja publique partout ou ce conducteur/passager apparait.
  async listerAvisUtilisateur(userId: string) {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: { id: true, note: true, nombreNotations: true },
    });
    if (!utilisateur) {
      throw new NotFoundException('Cet utilisateur est introuvable.');
    }

    const notations = await this.prisma.notation.findMany({
      where: { destinataireId: userId },
      select: {
        id: true,
        etoiles: true,
        commentaire: true,
        createdAt: true,
        noteur: { select: { nom: true, prenom: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      note: utilisateur.note,
      nombreNotations: utilisateur.nombreNotations,
      avis: notations,
    };
  }

  // Trajets termines ou l'utilisateur (comme conducteur ou comme passager)
  // n'a pas encore note tous ses co-participants -- alimente le rappel sur
  // l'Accueil (front_mobile) pour que la moyenne des conducteurs repose sur
  // plus que la poignee d'avis laisses spontanement.
  async listerNotationsEnAttente(userId: string) {
    const [commeConducteur, commePassager] = await Promise.all([
      this.prisma.trajet.findMany({
        where: { conducteurId: userId, statut: 'termine' },
        include: {
          reservations: {
            where: { statut: 'confirmee' },
            select: {
              passagerId: true,
              passager: { select: { nom: true, prenom: true } },
            },
          },
          notations: { where: { noteurId: userId }, select: { destinataireId: true } },
        },
      }),
      this.prisma.trajet.findMany({
        where: {
          statut: 'termine',
          reservations: { some: { passagerId: userId, statut: 'confirmee' } },
        },
        include: {
          conducteur: { select: { id: true, nom: true, prenom: true } },
          notations: { where: { noteurId: userId }, select: { destinataireId: true } },
        },
      }),
    ]);

    const resultats: { trajetId: string; cibles: { id: string; label: string }[] }[] =
      [];

    for (const trajet of commeConducteur) {
      const dejaNotes = new Set(trajet.notations.map((n) => n.destinataireId));
      const cibles = trajet.reservations
        .filter((r) => !dejaNotes.has(r.passagerId))
        .map((r) => ({
          id: r.passagerId,
          label: r.passager.nom ?? r.passager.prenom ?? 'Passager',
        }));
      if (cibles.length > 0) resultats.push({ trajetId: trajet.id, cibles });
    }

    for (const trajet of commePassager) {
      const dejaNote = trajet.notations.some(
        (n) => n.destinataireId === trajet.conducteurId,
      );
      if (!dejaNote) {
        resultats.push({
          trajetId: trajet.id,
          cibles: [
            {
              id: trajet.conducteur.id,
              label:
                trajet.conducteur.nom ?? trajet.conducteur.prenom ?? 'Conducteur',
            },
          ],
        });
      }
    }

    return resultats;
  }
}
