import { PrismaService } from '../../prisma/prisma.service';

// Statuts d'une Demande avant qu'un conducteur ne l'accepte (aucun Trajet lie
// pour l'instant) -- distinct du cas "acceptee" ci-dessous, dont l'activite
// reelle depend alors du Trajet cree, pas du statut fige de la Demande.
const DEMANDE_STATUTS_EN_ATTENTE = ['ouverte', 'quota_atteint'];

const TRAJET_STATUTS_ACTIFS = ['ouvert', 'commence'];

// Une fois acceptee, le statut d'une Demande reste "acceptee" pour toujours
// (rien ne le fait evoluer quand le Trajet associe se termine/s'annule --
// c'est le Trajet qui porte le cycle de vie a partir de la, voir
// TrajetsService.terminerTrajet/annulerTrajet). Une Demande "acceptee" ne
// compte donc comme active que si son Trajet lie est encore ouvert/commence,
// sinon un etudiant resterait bloque a vie des sa premiere course terminee.
function demandeActiveWhere() {
  return {
    OR: [
      { statut: { in: DEMANDE_STATUTS_EN_ATTENTE } },
      { statut: 'acceptee', trajet: { statut: { in: TRAJET_STATUTS_ACTIFS } } },
    ],
  };
}

// Un utilisateur ne peut etre implique -- comme createur, participant,
// conducteur ou passager -- que dans un seul trajet/demande actif a la fois.
// Centralise ici pour que creerDemande, rejoindreDemande, publierTrajet,
// reserverTrajet et accepterDemande appliquent tous la meme regle, quel que
// soit le role concerne (un meme utilisateur ne doit pas pouvoir jongler
// entre plusieurs trajets/demandes en parallele).
export async function aUneActiviteActive(
  prisma: PrismaService,
  userId: string,
): Promise<boolean> {
  const [demandeCreee, participation, trajetConduit, reservation] =
    await Promise.all([
      prisma.demande.findFirst({
        where: { createurId: userId, ...demandeActiveWhere() },
      }),
      prisma.participation.findFirst({
        where: {
          userId,
          statut: 'confirmee',
          demande: demandeActiveWhere(),
        },
      }),
      prisma.trajet.findFirst({
        where: { conducteurId: userId, statut: { in: TRAJET_STATUTS_ACTIFS } },
      }),
      prisma.reservation.findFirst({
        where: {
          passagerId: userId,
          statut: 'confirmee',
          trajet: { statut: { in: TRAJET_STATUTS_ACTIFS } },
        },
      }),
    ]);

  return Boolean(demandeCreee || participation || trajetConduit || reservation);
}
