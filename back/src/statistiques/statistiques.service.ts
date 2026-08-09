import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatistiquesService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenirStatistiques() {
    const debutJour = new Date();
    debutJour.setUTCHours(0, 0, 0, 0);
    const finJour = new Date();
    finJour.setUTCHours(23, 59, 59, 999);

    const [
      trajetsAujourdhui,
      demandesEnAttente,
      conducteursAValider,
      signalementsOuverts,
    ] = await Promise.all([
      this.prisma.trajet.count({
        where: { heure: { gte: debutJour, lte: finJour } },
      }),
      this.prisma.demande.count({ where: { statut: 'ouverte' } }),
      this.prisma.documentsConducteur.count({
        where: { statut: 'en attente' },
      }),
      this.prisma.signalement.count({ where: { statut: 'ouvert' } }),
    ]);

    return {
      trajetsAujourdhui,
      demandesEnAttente,
      conducteursAValider,
      signalementsOuverts,
    };
  }
}
