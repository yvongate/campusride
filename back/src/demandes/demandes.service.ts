import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { distanceKm } from '../common/utils/haversine';
import { PrismaService } from '../prisma/prisma.service';
import { TrajetsService } from '../trajets/trajets.service';
import { CreateDemandeDto } from './dto/create-demande.dto';
import { JoinDemandeDto } from './dto/join-demande.dto';

// Meme duree que OVERLAP_WINDOW_MS/LATE_CANCELLATION_WINDOW_MS/
// PASSENGER_CANCELLATION_DEADLINE_MS (Stories 3.1/3.5/3.6) mais concept
// distinct (§4.1 -- delai avant depart en dessous duquel une demande sans
// quota atteint expire) -- constante separee volontairement, voir Story 4.4
// Dev Notes.
const EXPIRATION_DEADLINE_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class DemandesService {
  private readonly logger = new Logger(DemandesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trajetsService: TrajetsService,
  ) {}

  // Verification d'identite generale (CNI + selfie, Story 5.4) : requise
  // avant toute interaction reelle avec d'autres utilisateurs (creer/
  // rejoindre une demande, reserver un trajet) -- pas seulement pour
  // devenir conducteur (voir UsersService.createDemandeConducteur, meme
  // garde-fou).
  private async verifierIdentiteValidee(userId: string): Promise<void> {
    const verification = await this.prisma.verificationIdentite.findFirst({
      where: { userId, statut: 'valide' },
    });
    if (!verification) {
      throw new ConflictException(
        'Complete d’abord ta verification d’identite (CNI + selfie) avant d’interagir avec les demandes',
      );
    }
  }

  async creerDemande(createurId: string, dto: CreateDemandeDto) {
    await this.verifierIdentiteValidee(createurId);

    const universite = await this.prisma.universite.findUnique({
      where: { id: dto.universiteId },
    });
    if (!universite) {
      throw new BadRequestException("L'universite est introuvable");
    }

    const commune = await this.prisma.commune.findUnique({
      where: { id: dto.communeId },
    });
    if (!commune) {
      throw new BadRequestException('La commune est introuvable');
    }

    // Un seul demande active a la fois par createur (ouverte, en attente
    // d'un conducteur, ou deja acceptee) -- evite qu'un meme utilisateur
    // jongle entre plusieurs demandes en parallele.
    const demandeActive = await this.prisma.demande.findFirst({
      where: {
        createurId,
        statut: { in: ['ouverte', 'quota_atteint', 'acceptee'] },
      },
    });
    if (demandeActive) {
      throw new ConflictException(
        'Tu as deja une demande active -- annule-la avant d’en creer une autre',
      );
    }

    // "Quartier ou POI" (§4.1) : seul un POI porte des coordonnees GPS dans
    // ce schema (Quartier n'en a pas) -- le POI fournit donc la position du
    // createur quand il n'utilise pas sa position GPS reelle (voir Story 4.1,
    // Dev Notes -- "quartier" reste un tag informatif optionnel sur Demande).
    let positionLat: number;
    let positionLng: number;
    if (dto.chezMoi) {
      positionLat = dto.lat as number;
      positionLng = dto.lng as number;
    } else {
      const poi = await this.prisma.pointInteret.findUnique({
        where: { id: dto.poiId },
      });
      if (!poi) {
        throw new BadRequestException(
          'Le point de rendez-vous est introuvable',
        );
      }
      // lat/lng optionnels ici = epingle affinee par l'utilisateur sur la
      // carte (front_mobile), prioritaire sur la position fixe du POI.
      positionLat = dto.lat ?? poi.latitude;
      positionLng = dto.lng ?? poi.longitude;
    }

    // Transaction interactive (pas le tableau statique habituel des autres
    // stories) : la creation de la Participation depend de l'id de la
    // Demande cree juste avant, dans la meme ecriture atomique.
    const demande = await this.prisma.$transaction(async (tx) => {
      const nouvelleDemande = await tx.demande.create({
        data: {
          createurId,
          universiteId: dto.universiteId,
          communeId: dto.communeId,
          quartierId: dto.quartierId,
          poiId: dto.chezMoi ? undefined : dto.poiId,
          heure: new Date(dto.heure),
          placesRecherchees: dto.placesRecherchees,
          cotisation: dto.cotisation,
          statut: 'ouverte',
        },
      });

      await tx.participation.create({
        data: {
          demandeId: nouvelleDemande.id,
          userId: createurId,
          positionLat,
          positionLng,
          statut: 'confirmee',
        },
      });

      return nouvelleDemande;
    });

    // Couvre le cas limite d'une demande creee avec placesRecherchees: 1 --
    // le createur atteint le quota des sa propre creation (voir Story 4.3,
    // Dev Notes).
    await this.verifierQuotaEtCalculerPoint(demande.id);

    return demande;
  }

  private async countParticipationsConfirmees(
    demandeId: string,
  ): Promise<number> {
    return this.prisma.participation.count({
      where: { demandeId, statut: 'confirmee' },
    });
  }

  async listerDemandes(
    universiteId: string,
    communeId: string,
    userId: string,
  ) {
    const demandes = await this.prisma.demande.findMany({
      where: { universiteId, communeId, statut: 'ouverte' },
      include: {
        createur: { select: { id: true, nom: true, prenom: true, note: true } },
      },
      orderBy: { heure: 'asc' },
    });

    // dejaRejoint : permet au front (Accueil) d'afficher "Deja rejoint" au
    // lieu du bouton "Rejoindre". Pas de filtre `demandeId: { in: [...] }`
    // ici volontairement -- un tableau de taille variable dans le where a
    // declenche des erreurs Postgres "bind message supplies N parameters"
    // intermittentes avec l'adapter Prisma 7 (requetes de forme differente
    // reutilisant un plan prepare incompatible sur une connexion du pool) ;
    // le nombre de participations d'un utilisateur reste de toute facon
    // minime a l'echelle de l'appli, donc un filtre statique est plus sur.
    const mesParticipations = await this.prisma.participation.findMany({
      where: { userId, statut: 'confirmee' },
      select: { demandeId: true },
    });
    const demandeIdsRejointes = new Set(
      mesParticipations.map((p) => p.demandeId),
    );

    return Promise.all(
      demandes.map(async (demande) => ({
        ...demande,
        placesRestantes:
          demande.placesRecherchees -
          (await this.countParticipationsConfirmees(demande.id)),
        dejaRejoint: demandeIdsRejointes.has(demande.id),
      })),
    );
  }

  // Ecran "Mes trajets" (front_mobile, onglet "Demandes") : une demande
  // n'obtient de Reservation (donc de visibilite via listerMesReservations)
  // qu'une fois acceptee par un conducteur -- avant ca (statuts "ouverte" et
  // "quota_atteint") seule la Participation existe, d'ou ce point d'entree
  // dedie pour que le createur/participant retrouve sa demande en cours.
  async listerMesDemandes(userId: string) {
    const demandes = await this.prisma.demande.findMany({
      where: { participations: { some: { userId, statut: 'confirmee' } } },
      include: {
        universite: true,
        commune: true,
        poi: true,
      },
      orderBy: { heure: 'desc' },
    });

    return Promise.all(
      demandes.map(async (demande) => ({
        ...demande,
        placesConfirmees: await this.countParticipationsConfirmees(demande.id),
      })),
    );
  }

  async rejoindreDemande(
    userId: string,
    demandeId: string,
    dto: JoinDemandeDto,
  ) {
    await this.verifierIdentiteValidee(userId);

    const demande = await this.prisma.demande.findUnique({
      where: { id: demandeId },
    });
    if (!demande) {
      throw new NotFoundException('Demande introuvable');
    }
    if (demande.statut !== 'ouverte') {
      throw new ConflictException("Cette demande n'est plus ouverte");
    }

    const dejaParticipant = await this.prisma.participation.findFirst({
      where: { demandeId, userId, statut: 'confirmee' },
    });
    if (dejaParticipant) {
      throw new ConflictException('Tu participes deja a cette demande');
    }

    const participationsConfirmees =
      await this.countParticipationsConfirmees(demandeId);
    if (participationsConfirmees >= demande.placesRecherchees) {
      throw new ConflictException('Cette demande a deja atteint son quota');
    }

    const participation = await this.prisma.participation.create({
      data: {
        demandeId,
        userId,
        positionLat: dto.lat,
        positionLng: dto.lng,
        statut: 'confirmee',
      },
    });

    await this.verifierQuotaEtCalculerPoint(demandeId);

    return participation;
  }

  private async verifierQuotaEtCalculerPoint(demandeId: string) {
    const demande = await this.prisma.demande.findUnique({
      where: { id: demandeId },
    });
    if (!demande || demande.statut !== 'ouverte') {
      return;
    }

    const participations = await this.prisma.participation.findMany({
      where: { demandeId, statut: 'confirmee' },
      select: { userId: true, positionLat: true, positionLng: true },
    });
    if (participations.length < demande.placesRecherchees) {
      return;
    }

    const centroidLat =
      participations.reduce((somme, p) => somme + p.positionLat, 0) /
      participations.length;
    const centroidLng =
      participations.reduce((somme, p) => somme + p.positionLng, 0) /
      participations.length;

    // Recherche restreinte a la commune de la demande, voir Story 4.3 Dev
    // Notes -- chercher parmi tous les POI de la plateforme n'a pas de sens
    // domaine.
    const pois = await this.prisma.pointInteret.findMany({
      where: { quartier: { communeId: demande.communeId } },
    });

    let poiProche: (typeof pois)[number] | null = null;
    let distanceMin = Infinity;
    for (const poi of pois) {
      const d = distanceKm(
        centroidLat,
        centroidLng,
        poi.latitude,
        poi.longitude,
      );
      if (d < distanceMin) {
        distanceMin = d;
        poiProche = poi;
      }
    }

    const destinataires = participations.map((p) => p.userId);

    if (poiProche) {
      await this.prisma.demande.update({
        where: { id: demandeId },
        data: { statut: 'quota_atteint', poiId: poiProche.id },
      });
      for (const userId of destinataires) {
        this.logger.log(
          `notification: point de regroupement suggere (${poiProche.nom}, ${distanceMin.toFixed(2)}km du centroide) pour la demande ${demandeId}, participant ${userId}`,
        );
      }
    } else {
      // Aucun POI enregistre dans la commune de la demande -- cas limite,
      // le seed couvre desormais toutes les communes d'Abidjan.
      await this.prisma.demande.update({
        where: { id: demandeId },
        data: { statut: 'quota_atteint' },
      });
      for (const userId of destinataires) {
        this.logger.log(
          `notification: aucun point de regroupement disponible (commune sans POI) pour la demande ${demandeId}, participant ${userId} invite a choisir manuellement`,
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expirerDemandesEnRetard() {
    const demandes = await this.prisma.demande.findMany({
      where: {
        statut: 'ouverte',
        heure: { lte: new Date(Date.now() + EXPIRATION_DEADLINE_MS) },
      },
      include: {
        participations: {
          where: { statut: 'confirmee' },
          select: { userId: true },
        },
      },
    });

    for (const demande of demandes) {
      await this.prisma.demande.update({
        where: { id: demande.id },
        data: { statut: 'expiree' },
      });
      // Pas de livraison push reelle : meme limitation que le reste du projet.
      for (const { userId } of demande.participations) {
        this.logger.log(
          `notification: demande ${demande.id} expiree pour ${userId}`,
        );
      }
    }
  }

  async listerDemandesDisponibles(universiteId: string, communeId: string) {
    return this.prisma.demande.findMany({
      where: {
        universiteId,
        communeId,
        statut: 'quota_atteint',
        poiId: { not: null },
      },
      include: {
        createur: { select: { id: true, nom: true, prenom: true, note: true } },
        poi: true,
      },
      orderBy: { heure: 'asc' },
    });
  }

  // Ecran "Point de regroupement" (front_mobile) : un participant consulte
  // le detail d'une demande qu'il a rejointe (quota, POI suggere, et une
  // fois acceptee, le conducteur qui a accepte via demande.trajetId --
  // seule facon de relier Demande -> Trajet, voir schema.prisma).
  async getDemandeDetail(userId: string, demandeId: string) {
    const demande = await this.prisma.demande.findUnique({
      where: { id: demandeId },
      include: {
        createur: { select: { id: true, nom: true, prenom: true, note: true } },
        universite: true,
        commune: true,
        poi: true,
      },
    });
    if (!demande) {
      throw new NotFoundException('Demande introuvable');
    }

    // Consultable par n'importe quel utilisateur authentifie (previsualiser
    // avant de rejoindre depuis Accueil) -- rejoindreDemande/accepterDemande
    // restent les actions protegees, celle-ci n'expose rien de plus sensible
    // que listerDemandes.
    const estParticipant = Boolean(
      await this.prisma.participation.findFirst({
        where: { demandeId, userId, statut: 'confirmee' },
      }),
    );

    const placesConfirmees =
      await this.countParticipationsConfirmees(demandeId);

    let conducteur: {
      nom: string | null;
      prenom: string | null;
      note: number | null;
      matriculeVehicule: string | null;
    } | null = null;
    if (demande.trajetId) {
      const trajet = await this.prisma.trajet.findUnique({
        where: { id: demande.trajetId },
      });
      if (trajet) {
        const conducteurUser = await this.prisma.utilisateur.findUnique({
          where: { id: trajet.conducteurId },
        });
        const documents = await this.prisma.documentsConducteur.findFirst({
          where: { userId: trajet.conducteurId, statut: 'valide' },
          orderBy: { createdAt: 'desc' },
        });
        conducteur = conducteurUser
          ? {
              nom: conducteurUser.nom,
              prenom: conducteurUser.prenom,
              note: conducteurUser.note,
              matriculeVehicule: documents?.matriculeVehicule ?? null,
            }
          : null;
      }
    }

    return {
      ...demande,
      placesConfirmees,
      conducteur,
      estParticipant,
    };
  }

  // Seul le createur peut annuler, et uniquement avant qu'un conducteur ait
  // accepte (statut "acceptee" => un Trajet + des Reservation existent deja,
  // c'est l'annulation du Trajet cote conducteur qui s'applique alors, pas
  // celle-ci).
  async annulerDemande(userId: string, demandeId: string) {
    const demande = await this.prisma.demande.findUnique({
      where: { id: demandeId },
    });
    if (!demande) {
      throw new NotFoundException('Demande introuvable');
    }
    if (demande.createurId !== userId) {
      throw new ForbiddenException(
        "Seul le createur de la demande peut l'annuler",
      );
    }
    if (demande.statut !== 'ouverte' && demande.statut !== 'quota_atteint') {
      throw new ConflictException('Cette demande ne peut plus etre annulee');
    }

    return this.prisma.demande.update({
      where: { id: demandeId },
      data: { statut: 'annulee' },
    });
  }

  async accepterDemande(conducteurId: string, demandeId: string) {
    const demande = await this.prisma.demande.findUnique({
      where: { id: demandeId },
    });
    if (!demande) {
      throw new NotFoundException('Demande introuvable');
    }
    if (demande.statut !== 'quota_atteint') {
      throw new ConflictException(
        "Cette demande n'a pas encore atteint son quota",
      );
    }
    if (!demande.poiId) {
      throw new ConflictException(
        "Cette demande n'a pas de point de regroupement suggere",
      );
    }

    // Meme garde-fou que la publication d'un trajet Mode B (Story 3.1) --
    // extrait pour etre reutilise ici sans dupliquer la logique.
    await this.trajetsService.verifierConducteurEtChevauchement(
      conducteurId,
      demande.heure,
    );

    // Un seul trajet actif a la fois par conducteur (au-dela du simple
    // chevauchement horaire ci-dessus) -- ne peut pas accepter une nouvelle
    // demande tant qu'un trajet en cours n'est pas termine/annule.
    const trajetActif = await this.prisma.trajet.findFirst({
      where: { conducteurId, statut: { in: ['ouvert', 'commence'] } },
    });
    if (trajetActif) {
      throw new ConflictException(
        'Tu as deja un trajet actif -- termine-le avant d’en accepter un autre',
      );
    }

    const participations = await this.prisma.participation.findMany({
      where: { demandeId, statut: 'confirmee' },
      select: { userId: true },
    });

    const trajet = await this.prisma.$transaction(async (tx) => {
      const nouveauTrajet = await tx.trajet.create({
        data: {
          conducteurId,
          universiteId: demande.universiteId,
          pointDeRdvId: demande.poiId as string,
          heure: demande.heure,
          places: demande.placesRecherchees,
          prixTotal: demande.cotisation * participations.length,
          mode: 'A',
          statut: 'ouvert',
        },
      });

      // Une Reservation par Participation confirmee : le Trajet cree doit
      // etre pleinement compatible avec toute la gestion de trajet de
      // l'Epic 3 (annulation, no-show, futur Epic 6), qui s'appuie sur
      // Reservation, pas sur Participation (voir Story 4.5 Dev Notes).
      await tx.reservation.createMany({
        data: participations.map((p) => ({
          trajetId: nouveauTrajet.id,
          passagerId: p.userId,
          prixParPersonne: demande.cotisation,
          statut: 'confirmee',
        })),
      });

      await tx.demande.update({
        where: { id: demandeId },
        data: { statut: 'acceptee', trajetId: nouveauTrajet.id },
      });

      return nouveauTrajet;
    });

    // Pas de livraison push reelle : meme limitation que le reste du projet.
    for (const { userId } of participations) {
      this.logger.log(
        `notification: demande ${demandeId} acceptee par le conducteur, trajet ${trajet.id} cree pour ${userId}`,
      );
    }

    return trajet;
  }
}
