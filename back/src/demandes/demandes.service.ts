import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { aUneActiviteActive } from '../common/utils/activite-active';
import { verifierFenetreReservation } from '../common/utils/fenetre-reservation';
import { calculerSanctionAnnulationTardive } from '../common/utils/sanction-annulation';
import { distanceKm } from '../common/utils/haversine';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TrajetsService } from '../trajets/trajets.service';
import { CreateDemandeDto } from './dto/create-demande.dto';
import { JoinDemandeDto } from './dto/join-demande.dto';

// Concept distinct de OVERLAP_WINDOW_MS/LATE_CANCELLATION_WINDOW_MS/
// PASSENGER_CANCELLATION_DEADLINE_MS (Stories 3.1/3.5/3.6), qui restent a 2h
// -- constante separee volontairement, voir Story 4.4 Dev Notes (§4.1 --
// delai avant depart en dessous duquel une demande expire). S'applique aussi
// bien a une demande "ouverte" (quota jamais atteint) qu'a une demande
// "quota_atteint" (quota atteint mais aucun conducteur ne l'a acceptee a
// temps, voir expirerDemandesEnRetard) -- sans ce 2e cas, une demande
// "quota_atteint" restait coincee indefiniment, ce qui bloquait aussi
// createur et participants via aUneActiviteActive (un seul trajet/demande
// actif a la fois).
const EXPIRATION_DEADLINE_MS = 75 * 60 * 1000;

// §5 : "Si le Point d'Interet le plus proche du centroide se trouve au-dela
// d'une distance maximale raisonnable (par exemple 1,5 km), l'application ne
// suggere pas ce point automatiquement". Sans ce plafond, le POI le plus
// proche etait retenu quelle que soit la distance -- un seul participant avec
// une position GPS aberrante suffisait a envoyer tout le groupe a l'autre
// bout de la commune.
const DISTANCE_MAX_POINT_REGROUPEMENT_KM = 1.5;

@Injectable()
export class DemandesService {
  private readonly logger = new Logger(DemandesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trajetsService: TrajetsService,
    private readonly notifications: NotificationsService,
  ) {}

  async creerDemande(createurId: string, dto: CreateDemandeDto) {
    const universite = await this.prisma.universite.findUnique({
      where: { id: dto.universiteId },
    });
    if (!universite) {
      throw new BadRequestException('Cette université est introuvable.');
    }

    const commune = await this.prisma.commune.findUnique({
      where: { id: dto.communeId },
    });
    if (!commune) {
      throw new BadRequestException('Cette commune est introuvable.');
    }

    verifierFenetreReservation(new Date(dto.heure));

    // Un seul trajet/demande actif a la fois, tous roles confondus (createur,
    // participant, conducteur ou passager) -- voir aUneActiviteActive.
    if (await aUneActiviteActive(this.prisma, createurId)) {
      throw new ConflictException(
        "Tu as déjà une activité en cours (trajet ou demande). Termine-la avant d'en créer une nouvelle.",
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
        include: { quartier: true },
      });
      if (!poi) {
        throw new BadRequestException('Ce point de repère est introuvable.');
      }
      // L'UI mobile enchaine commune -> quartier -> POI, donc le cas
      // n'arrive pas depuis l'app ; mais l'API acceptait un POI d'une autre
      // commune que celle declaree, et verifierQuotaEtCalculerPoint cherche
      // ensuite le point de regroupement parmi les POI de demande.communeId
      // -- soit une commune sans rapport avec le depart reel du createur.
      if (poi.quartier.communeId !== dto.communeId) {
        throw new BadRequestException(
          "Ce point de repère n'est pas dans la commune choisie.",
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
          // poiId reste null a la creation, meme si chezMoi=false (la
          // position choisie par le createur est deja capturee sur SA
          // Participation, positionLat/positionLng ci-dessous) -- ce champ
          // est reserve au point de regroupement du GROUPE, calcule une
          // seule fois par verifierQuotaEtCalculerPoint quand le quota est
          // atteint. L'ecrire ici affichait un "point suggere" premature
          // (celui du createur seul) des la creation, avant meme qu'aucun
          // autre participant n'ait rejoint.
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
      where: {
        universiteId,
        communeId,
        statut: 'ouverte',
      },
      include: {
        createur: { select: { id: true, nom: true, prenom: true, note: true, nombreNotations: true } },
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
    const demande = await this.prisma.demande.findUnique({
      where: { id: demandeId },
    });
    if (!demande) {
      throw new NotFoundException('Cette demande est introuvable.');
    }
    if (demande.statut !== 'ouverte') {
      throw new ConflictException(
        "Cette demande n'accepte plus de nouveaux participants.",
      );
    }

    // Un seul trajet/demande actif a la fois, tous roles confondus -- voir
    // aUneActiviteActive.
    if (await aUneActiviteActive(this.prisma, userId)) {
      throw new ConflictException(
        "Tu as déjà une activité en cours. Termine-la avant d'en rejoindre une autre.",
      );
    }

    const dejaParticipant = await this.prisma.participation.findFirst({
      where: { demandeId, userId, statut: 'confirmee' },
    });
    if (dejaParticipant) {
      throw new ConflictException('Tu as déjà rejoint cette demande.');
    }

    // Comptage ET creation dans la meme transaction serialisable : en
    // "compter puis creer" hors transaction, deux etudiants rejoignant la
    // derniere place au meme instant passaient tous les deux le test, et le
    // groupe depassait le nombre demande (le Trajet cree ensuite par
    // accepterDemande se retrouvait avec plus de reservations que de places).
    const participation = await this.prisma.$transaction(
      async (tx) => {
        const participationsConfirmees = await tx.participation.count({
          where: { demandeId, statut: 'confirmee' },
        });
        if (participationsConfirmees >= demande.placesRecherchees) {
          throw new ConflictException('Cette demande est déjà complète.');
        }

        return tx.participation.create({
          data: {
            demandeId,
            userId,
            positionLat: dto.lat,
            positionLng: dto.lng,
            statut: 'confirmee',
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );

    // "Nouveau passager a rejoint votre demande" (§9) : prevu depuis la v1.0
    // mais jamais implemente -- le createur ne voyait rien bouger. Envoye
    // avant le calcul de quota pour que l'ordre des notifications recues
    // suive l'ordre des evenements ("X a rejoint" puis "groupe complet").
    await this.notifications.envoyer(
      [demande.createurId],
      'Quelqu\'un a rejoint ta demande',
      'Un étudiant vient de rejoindre ton groupe.',
      { type: 'demande', id: demandeId },
    );

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

    // Au-dela du plafond, on prefere ne rien suggerer plutot que d'imposer un
    // point de rendez-vous absurde : la demande atteint bien son quota mais
    // reste sans POI (elle ne pourra pas etre acceptee en l'etat, voir
    // accepterDemande, et expirera si personne n'ajuste sa position).
    if (poiProche && distanceMin > DISTANCE_MAX_POINT_REGROUPEMENT_KM) {
      await this.prisma.demande.update({
        where: { id: demandeId },
        data: { statut: 'quota_atteint' },
      });
      this.logger.log(
        `demande ${demandeId} : POI le plus proche (${poiProche.nom}) a ${distanceMin.toFixed(2)}km du centroide, au-dela du plafond de ${DISTANCE_MAX_POINT_REGROUPEMENT_KM}km`,
      );
      await this.notifications.envoyer(
        destinataires,
        'Groupe complet, mais aucun point trouvé',
        "Vos positions sont trop éloignées les unes des autres pour proposer un point de rendez-vous. Ajustez votre position de départ.",
        { type: 'demande', id: demandeId },
      );
      return;
    }

    if (poiProche) {
      await this.prisma.demande.update({
        where: { id: demandeId },
        data: { statut: 'quota_atteint', poiId: poiProche.id },
      });
      await this.notifications.envoyer(
        destinataires,
        'Point de regroupement trouvé',
        `Rendez-vous à ${poiProche.nom}. Votre demande est maintenant visible par les conducteurs.`,
        { type: 'demande', id: demandeId },
      );
    } else {
      // Aucun POI enregistre dans la commune de la demande -- cas limite,
      // le seed couvre desormais toutes les communes d'Abidjan.
      await this.prisma.demande.update({
        where: { id: demandeId },
        data: { statut: 'quota_atteint' },
      });
      await this.notifications.envoyer(
        destinataires,
        'Groupe complet, mais aucun point trouvé',
        "Aucun lieu de rendez-vous n'est enregistré dans cette commune.",
        { type: 'demande', id: demandeId },
      );
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expirerDemandesEnRetard() {
    const demandes = await this.prisma.demande.findMany({
      where: {
        statut: { in: ['ouverte', 'quota_atteint'] },
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
      await this.notifications.envoyer(
        demande.participations.map((p) => p.userId),
        'Demande expirée',
        "Aucun conducteur n'a accepté votre demande à temps. Tu peux en créer une nouvelle.",
        { type: 'demande', id: demande.id },
      );
    }
  }

  // universiteId optionnel : un conducteur "chauffeur" (voir
  // Utilisateur.role) n'a pas d'universite de rattachement et doit voir
  // toutes les demandes de la commune, quelle que soit l'universite visee.
  async listerDemandesDisponibles(communeId: string, universiteId?: string) {
    return this.prisma.demande.findMany({
      where: {
        communeId,
        ...(universiteId ? { universiteId } : {}),
        statut: 'quota_atteint',
        poiId: { not: null },
      },
      include: {
        createur: { select: { id: true, nom: true, prenom: true, note: true, nombreNotations: true } },
        universite: true,
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
        createur: { select: { id: true, nom: true, prenom: true, note: true, nombreNotations: true } },
        universite: true,
        commune: true,
        poi: true,
      },
    });
    if (!demande) {
      throw new NotFoundException('Cette demande est introuvable.');
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
      nombreNotations: number;
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
              nombreNotations: conducteurUser.nombreNotations,
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
      throw new NotFoundException('Cette demande est introuvable.');
    }
    if (demande.createurId !== userId) {
      throw new ForbiddenException(
        "Seul le créateur de la demande peut l'annuler.",
      );
    }
    if (demande.statut !== 'ouverte' && demande.statut !== 'quota_atteint') {
      throw new ConflictException('Cette demande ne peut plus être annulée.');
    }

    // Recuperes avant la mise a jour -- une fois "annulee", plus aucun moyen
    // de savoir qui etait implique.
    const autresParticipants = await this.prisma.participation.findMany({
      where: { demandeId, statut: 'confirmee', userId: { not: userId } },
      select: { userId: true },
    });

    // Casser un groupe ou d'autres s'etaient deja engages compte comme une
    // annulation tardive, au meme titre qu'un passager qui se desiste au
    // dernier moment (§8.2) : dans les deux cas des gens perdent leur trajet.
    // Le critere n'est pas le DELAI mais la PRESENCE de participants -- une
    // demande ne survit jamais au-dela du seuil de 1h15 (le cron d'expiration
    // la supprime), donc un critere temporel ne se declencherait jamais.
    // Annuler une demande que personne n'a rejointe reste libre et gratuit.
    const sanction =
      autresParticipants.length > 0
        ? await calculerSanctionAnnulationTardive(this.prisma, userId)
        : null;

    const demandeUpdate = this.prisma.demande.update({
      where: { id: demandeId },
      data: { statut: 'annulee' },
    });

    // Meme structure a deux branches statiques qu'ailleurs (Story 3.5) : la
    // sanction et l'annulation doivent etre atomiques.
    const demandeAnnulee =
      sanction === null
        ? (await this.prisma.$transaction([demandeUpdate]))[0]
        : (
            await this.prisma.$transaction([
              demandeUpdate,
              this.prisma.utilisateur.update({
                where: { id: userId },
                data: sanction.data,
              }),
            ])
          )[0];

    await this.notifications.envoyer(
      autresParticipants.map((p) => p.userId),
      'Demande annulée',
      "Le créateur a annulé cette demande. Tu peux en rejoindre une autre.",
      { type: 'demande', id: demandeId },
    );

    if (sanction?.suspenduJusqua) {
      await this.notifications.envoyer(
        [userId],
        'Compte suspendu',
        `Suite à une 2e annulation tardive, ton compte est suspendu jusqu'au ${sanction.suspenduJusqua.toLocaleDateString('fr-FR')}.`,
        { type: 'compte' },
      );
    }

    // Renvoye au mobile pour qu'il explique avant de deconnecter, plutot que
    // de laisser l'utilisateur se prendre un 401 muet (meme traitement que
    // TrajetsService.annulerReservation).
    return {
      ...demandeAnnulee,
      suspenduJusqua: sanction?.suspenduJusqua ?? null,
    };
  }

  // Un participant (pas le createur) peut se retirer tant que la demande n'a
  // pas encore ete acceptee par un conducteur (statut "acceptee" => Trajet +
  // Reservation existent deja, c'est annulerReservation qui s'applique
  // alors, pas celle-ci -- meme separation que annulerDemande/annulerTrajet).
  async quitterDemande(userId: string, demandeId: string) {
    const demande = await this.prisma.demande.findUnique({
      where: { id: demandeId },
    });
    if (!demande) {
      throw new NotFoundException('Cette demande est introuvable.');
    }
    if (demande.createurId === userId) {
      throw new ForbiddenException(
        "Tu es le créateur de cette demande. Utilise l'annulation pour la retirer.",
      );
    }
    if (demande.statut !== 'ouverte' && demande.statut !== 'quota_atteint') {
      throw new ConflictException('Tu ne peux plus quitter cette demande.');
    }

    const participation = await this.prisma.participation.findFirst({
      where: { demandeId, userId, statut: 'confirmee' },
    });
    if (!participation) {
      throw new NotFoundException("Tu n'as pas rejoint cette demande.");
    }

    // Meme structure a deux branches statiques que annulerTrajet/
    // annulerReservation (Stories 3.5/3.6) -- ne pas construire un tableau
    // d'operations dynamique caste, cela ne compile pas (TS2352, deja
    // rencontre et documente dans la Story 3.5).
    if (demande.statut === 'quota_atteint') {
      // Quitter fait retomber le nombre de participants confirmes en
      // dessous du quota -- la demande redevient "ouverte" et le point de
      // regroupement calcule pour un groupe qui n'existe plus est efface ;
      // verifierQuotaEtCalculerPoint le recalculera si/quand le quota est de
      // nouveau atteint.
      await this.prisma.$transaction([
        this.prisma.participation.update({
          where: { id: participation.id },
          data: { statut: 'annulee' },
        }),
        this.prisma.demande.update({
          where: { id: demandeId },
          data: { statut: 'ouverte', poiId: null },
        }),
      ]);
    } else {
      await this.prisma.$transaction([
        this.prisma.participation.update({
          where: { id: participation.id },
          data: { statut: 'annulee' },
        }),
      ]);
    }

    // Le createur voit son groupe se defaire : sans notification, il ne
    // l'apprend qu'en rouvrant l'app par hasard.
    await this.notifications.envoyer(
      [demande.createurId],
      'Un participant a quitté ta demande',
      demande.statut === 'quota_atteint'
        ? 'Ta demande repasse en attente de participants.'
        : 'Une place est de nouveau disponible dans ton groupe.',
      { type: 'demande', id: demandeId },
    );
  }

  async accepterDemande(conducteurId: string, demandeId: string) {
    const demande = await this.prisma.demande.findUnique({
      where: { id: demandeId },
    });
    if (!demande) {
      throw new NotFoundException('Cette demande est introuvable.');
    }
    if (demande.statut === 'acceptee') {
      throw new ConflictException(
        "Cette demande a déjà été acceptée par un autre conducteur.",
      );
    }
    if (demande.statut !== 'quota_atteint') {
      throw new ConflictException(
        "Cette demande n'a pas encore assez de participants.",
      );
    }
    if (!demande.poiId) {
      throw new ConflictException(
        "Aucun point de regroupement n'a encore été trouvé pour cette demande.",
      );
    }

    // Meme garde-fou que la publication d'un trajet Mode B (Story 3.1) --
    // extrait pour etre reutilise ici sans dupliquer la logique.
    await this.trajetsService.verifierConducteurEtChevauchement(
      conducteurId,
      demande.heure,
    );

    // Un seul trajet/demande actif a la fois, tous roles confondus -- voir
    // aUneActiviteActive (meme regle que creerDemande/rejoindreDemande/
    // publierTrajet/reserverTrajet).
    if (await aUneActiviteActive(this.prisma, conducteurId)) {
      throw new ConflictException(
        "Tu as déjà une activité en cours. Termine-la avant d'en accepter une nouvelle.",
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
          // Cotisation reprise telle quelle : chaque participant paie le
          // montant fixe par le createur (§6.1), jamais un total redivise.
          cotisation: demande.cotisation,
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

    await this.notifications.envoyer(
      participations.map((p) => p.userId),
      'Un conducteur a accepté !',
      'Votre trajet est confirmé. Ouvre la messagerie pour vous coordonner.',
      { type: 'trajet', id: trajet.id },
    );

    return trajet;
  }
}
