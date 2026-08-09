import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { join } from 'path';
import { distanceKm } from '../common/utils/haversine';
import { MessagerieService } from '../messagerie/messagerie.service';
import { PrismaService } from '../prisma/prisma.service';
import { CONDUCTEUR_UPLOADS_DIR } from '../users/conducteur-files.storage';
import { CreateTrajetDto } from './dto/create-trajet.dto';
import { ListTrajetsQueryDto } from './dto/list-trajets-query.dto';
import { computePrixParPersonne } from './prix';

const TRAJET_DETAIL_INCLUDE = {
  conducteur: { select: { id: true, nom: true, prenom: true, note: true } },
  pointDeRdv: { include: { quartier: { include: { commune: true } } } },
  universite: true,
} as const;

// Aucune duree de trajet dans le modele (cahier des charges §13.2) -- fenetre
// de chevauchement fixee a 2h, reutilisant la valeur deja etablie ailleurs
// dans le domaine pour les delais lies au trajet (§8.1/§8.2).
const OVERLAP_WINDOW_MS = 2 * 60 * 60 * 1000;

// Meme duree que OVERLAP_WINDOW_MS mais concept distinct (delai avant depart
// a partir duquel une annulation est consideree "tardive", §8.2) -- constante
// separee volontairement, voir Story 3.5 Dev Notes.
const LATE_CANCELLATION_WINDOW_MS = 2 * 60 * 60 * 1000;

// Aucune formule n'est donnee par le cahier des charges pour la baisse de
// note -- mecanisme simplifie et provisoire, voir Story 3.5 Dev Notes.
const LATE_CANCELLATION_PENALTY = 0.5;
const MIN_NOTE = 1;

// "La note du conducteur baisse fortement, de la meme maniere qu'une
// annulation tardive" (§8.2) -- meme mecanisme que LATE_CANCELLATION_PENALTY
// (Story 3.5), magnitude volontairement plus forte (voir Story 3.7 Dev Notes).
const NO_SHOW_PENALTY = 1.0;

// Meme duree que OVERLAP_WINDOW_MS et LATE_CANCELLATION_WINDOW_MS mais concept
// distinct (delai avant depart en dessous duquel un PASSAGER ne peut plus
// annuler sa reservation, §8.1) -- constante separee volontairement, voir
// Story 3.6 Dev Notes (meme rationale que Story 3.5).
const PASSENGER_CANCELLATION_DEADLINE_MS = 2 * 60 * 60 * 1000;

const REMINDER_2H_MS = 2 * 60 * 60 * 1000;
const REMINDER_1H_MS = 1 * 60 * 60 * 1000;

// "La note du passager baisse automatiquement" (§8.1) -- meme mecanisme que
// LATE_CANCELLATION_PENALTY (Story 3.5), meme magnitude (infraction
// comparable, le trajet a quand meme eu lieu), voir Story 6.2 Dev Notes.
const PASSAGER_NO_SHOW_PENALTY = 0.5;

@Injectable()
export class TrajetsService {
  private readonly logger = new Logger(TrajetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagerieService: MessagerieService,
  ) {}

  // Extrait de publierTrajet (Story 3.1) pour etre reutilise par
  // DemandesService.accepterDemande (Story 4.5) -- meme garde-fou, une seule
  // implementation. Lecture seule, aucune ecriture.
  async verifierConducteurEtChevauchement(
    conducteurId: string,
    heure: Date,
  ): Promise<void> {
    // Lecture fraiche en base, jamais via le role embarque dans le JWT : un
    // conducteur peut etre valide par un admin apres l'emission de son JWT
    // (voir Story 3.1, Dev Notes -- piege de fraicheur identifie).
    const conducteur = await this.prisma.utilisateur.findUnique({
      where: { id: conducteurId },
    });
    if (!conducteur || conducteur.role !== 'les deux') {
      throw new ForbiddenException('Compte conducteur non valide');
    }

    const conflit = await this.prisma.trajet.findFirst({
      where: {
        conducteurId,
        statut: { not: 'annule' },
        heure: {
          gte: new Date(heure.getTime() - OVERLAP_WINDOW_MS),
          lte: new Date(heure.getTime() + OVERLAP_WINDOW_MS),
        },
      },
    });
    if (conflit) {
      throw new ConflictException('Un trajet chevauche deja ce creneau');
    }
  }

  async publierTrajet(conducteurId: string, dto: CreateTrajetDto) {
    const universite = await this.prisma.universite.findUnique({
      where: { id: dto.universiteId },
    });
    if (!universite) {
      throw new BadRequestException("L'universite est introuvable");
    }

    const pointDeRdv = await this.prisma.pointInteret.findUnique({
      where: { id: dto.pointDeRdvId },
    });
    if (!pointDeRdv) {
      throw new BadRequestException('Le point de rendez-vous est introuvable');
    }

    const heure = new Date(dto.heure);
    await this.verifierConducteurEtChevauchement(conducteurId, heure);

    return this.prisma.trajet.create({
      data: {
        conducteurId,
        universiteId: dto.universiteId,
        pointDeRdvId: dto.pointDeRdvId,
        heure,
        places: dto.places,
        prixTotal: dto.prixTotal,
        mode: 'B',
        statut: 'ouvert',
      },
    });
  }

  async listerTrajets(query: ListTrajetsQueryDto) {
    const trajets = await this.prisma.trajet.findMany({
      where: {
        universiteId: query.universiteId,
        statut: 'ouvert',
        pointDeRdv: { quartier: { communeId: query.communeId } },
      },
      include: {
        pointDeRdv: { include: { quartier: { include: { commune: true } } } },
        conducteur: {
          select: { id: true, nom: true, prenom: true, note: true },
        },
        universite: true,
      },
      // Trie par heure par defaut ; si lat/lng sont fournis, le tri par
      // distance (calcul non supporte par Prisma) remplace celui-ci ci-dessous.
      orderBy: { heure: 'asc' },
    });

    const withVerifie = trajets.map((trajet) => ({
      ...trajet,
      conducteur: { ...trajet.conducteur, verifie: true },
    }));

    if (query.lat === undefined || query.lng === undefined) {
      return withVerifie;
    }

    const lat = query.lat;
    const lng = query.lng;
    return withVerifie
      .map((trajet) => ({
        ...trajet,
        distanceKm: distanceKm(
          lat,
          lng,
          trajet.pointDeRdv.latitude,
          trajet.pointDeRdv.longitude,
        ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  private async countReservationsConfirmees(trajetId: string): Promise<number> {
    return this.prisma.reservation.count({
      where: { trajetId, statut: 'confirmee' },
    });
  }

  async getTrajetDetail(id: string) {
    const trajet = await this.prisma.trajet.findUnique({
      where: { id },
      include: TRAJET_DETAIL_INCLUDE,
    });
    if (!trajet) {
      throw new NotFoundException('Trajet introuvable');
    }

    const reservationsConfirmees = await this.countReservationsConfirmees(id);

    return {
      ...trajet,
      conducteur: { ...trajet.conducteur, verifie: true },
      placesDisponibles: trajet.places - reservationsConfirmees,
      // +1 : simule ma propre reservation si je la confirme maintenant,
      // evite une division par zero sur un trajet sans aucune reservation
      // (voir Story 3.3, Dev Notes).
      prixParPersonnePreview: computePrixParPersonne(
        trajet.prixTotal,
        reservationsConfirmees + 1,
      ),
    };
  }

  async listerMesTrajets(conducteurId: string) {
    const trajets = await this.prisma.trajet.findMany({
      where: { conducteurId },
      include: TRAJET_DETAIL_INCLUDE,
      orderBy: { heure: 'asc' },
    });

    return Promise.all(
      trajets.map(async (trajet) => {
        // Identite des passagers confirmes exposee uniquement au conducteur du
        // trajet (route deja scopee a conducteurId ci-dessus) -- necessaire
        // pour que l'ecran "Mes trajets" cote conducteur puisse cibler
        // signalerPassagerAbsent(trajetId, passagerId), qui n'a jusqu'ici
        // aucune source de passagerId cote front_mobile.
        const reservations = await this.prisma.reservation.findMany({
          where: { trajetId: trajet.id, statut: 'confirmee' },
          include: {
            passager: { select: { id: true, nom: true, prenom: true } },
          },
        });

        return {
          ...trajet,
          placesDisponibles: trajet.places - reservations.length,
          passagers: reservations.map((r) => r.passager),
        };
      }),
    );
  }

  async reserverTrajet(passagerId: string, trajetId: string) {
    const trajet = await this.prisma.trajet.findUnique({
      where: { id: trajetId },
    });
    if (!trajet) {
      throw new NotFoundException('Trajet introuvable');
    }
    if (trajet.statut !== 'ouvert') {
      throw new ConflictException("Ce trajet n'est plus disponible");
    }
    if (trajet.conducteurId === passagerId) {
      throw new ForbiddenException('Impossible de reserver son propre trajet');
    }

    const dejaReserve = await this.prisma.reservation.findFirst({
      where: { trajetId, passagerId, statut: 'confirmee' },
    });
    if (dejaReserve) {
      throw new ConflictException('Tu as deja reserve ce trajet');
    }

    const existingCount = await this.prisma.reservation.count({
      where: { trajetId, statut: 'confirmee' },
    });
    if (existingCount >= trajet.places) {
      throw new ConflictException('Ce trajet est complet');
    }

    // Prix partage recalcule et synchronise sur toutes les reservations
    // confirmees existantes : le cahier des charges (§6.2) decrit un prix
    // unique pour tous les passagers, pas un instantane fige a la creation
    // de chaque reservation (voir Story 3.3, Dev Notes).
    const prixParPersonne = computePrixParPersonne(
      trajet.prixTotal,
      existingCount + 1,
    );

    const [reservation] = await this.prisma.$transaction([
      this.prisma.reservation.create({
        data: { trajetId, passagerId, prixParPersonne, statut: 'confirmee' },
      }),
      this.prisma.reservation.updateMany({
        where: { trajetId, statut: 'confirmee' },
        data: { prixParPersonne },
      }),
    ]);

    // Pas de livraison push reelle : aucune infrastructure de notification
    // n'existe dans ce projet (voir Story 3.3, "Hors scope explicite").
    this.logger.log(
      `notification: reservation confirmee pour ${passagerId} sur le trajet ${trajetId}`,
    );

    return reservation;
  }

  private async changerStatutTrajet(
    conducteurId: string,
    trajetId: string,
    statutActuel: string,
    statutCible: string,
  ) {
    const trajet = await this.prisma.trajet.findUnique({
      where: { id: trajetId },
    });
    if (!trajet) {
      throw new NotFoundException('Trajet introuvable');
    }
    if (trajet.conducteurId !== conducteurId) {
      throw new ForbiddenException("Ce trajet ne t'appartient pas");
    }
    if (trajet.statut !== statutActuel) {
      throw new ConflictException(
        `Ce trajet doit etre "${statutActuel}" pour cette action`,
      );
    }

    return this.prisma.trajet.update({
      where: { id: trajetId },
      data: { statut: statutCible },
    });
  }

  async demarrerTrajet(conducteurId: string, trajetId: string) {
    return this.changerStatutTrajet(
      conducteurId,
      trajetId,
      'ouvert',
      'commence',
    );
  }

  async terminerTrajet(conducteurId: string, trajetId: string) {
    const trajet = await this.changerStatutTrajet(
      conducteurId,
      trajetId,
      'commence',
      'termine',
    );
    // "Le chat est automatiquement supprime" (§13.2, Story 6.1) -- effet de
    // bord de la transition vers "termine", pas une action separee.
    await this.messagerieService.supprimerChatTrajet(trajetId);
    return trajet;
  }

  async annulerTrajet(conducteurId: string, trajetId: string) {
    const trajet = await this.prisma.trajet.findUnique({
      where: { id: trajetId },
    });
    if (!trajet) {
      throw new NotFoundException('Trajet introuvable');
    }
    if (trajet.conducteurId !== conducteurId) {
      throw new ForbiddenException("Ce trajet ne t'appartient pas");
    }
    if (trajet.statut !== 'ouvert') {
      throw new ConflictException('Seul un trajet "ouvert" peut etre annule');
    }

    const estTardive =
      trajet.heure.getTime() - Date.now() < LATE_CANCELLATION_WINDOW_MS;

    // La note doit etre lue avant la transaction pour calculer la nouvelle
    // valeur, mais l'ecriture du trajet et celle de la note doivent rester
    // atomiques -- toutes deux dans le meme $transaction (voir Story 3.5,
    // ne pas laisser deux ecritures sequentielles non liees).
    let nouvelleNote: number | undefined;
    if (estTardive) {
      const conducteur = await this.prisma.utilisateur.findUnique({
        where: { id: conducteurId },
      });
      if (conducteur?.note !== null && conducteur?.note !== undefined) {
        nouvelleNote = Math.max(
          MIN_NOTE,
          conducteur.note - LATE_CANCELLATION_PENALTY,
        );
      }
    }

    const trajetUpdate = this.prisma.trajet.update({
      where: { id: trajetId },
      data: { statut: 'annule' },
    });

    const trajetAnnule =
      nouvelleNote === undefined
        ? (await this.prisma.$transaction([trajetUpdate]))[0]
        : (
            await this.prisma.$transaction([
              trajetUpdate,
              this.prisma.utilisateur.update({
                where: { id: conducteurId },
                data: { note: nouvelleNote },
              }),
            ])
          )[0];

    const passagers = await this.prisma.reservation.findMany({
      where: { trajetId, statut: 'confirmee' },
      select: { passagerId: true },
    });
    // Pas de livraison push reelle : meme limitation que Story 3.3/3.4.
    for (const { passagerId } of passagers) {
      this.logger.log(
        `notification: trajet ${trajetId} annule pour ${passagerId}`,
      );
    }

    return trajetAnnule;
  }

  async annulerReservation(passagerId: string, trajetId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { trajetId, passagerId, statut: 'confirmee' },
      include: { trajet: true },
    });
    if (!reservation) {
      throw new NotFoundException('Reservation introuvable');
    }

    const delaiRestant = reservation.trajet.heure.getTime() - Date.now();
    if (delaiRestant < PASSENGER_CANCELLATION_DEADLINE_MS) {
      throw new ConflictException(
        'Annulation impossible a moins de 2h du depart',
      );
    }

    const autresConfirmees = await this.prisma.reservation.count({
      where: { trajetId, statut: 'confirmee', id: { not: reservation.id } },
    });

    // Meme structure a deux branches statiques que annulerTrajet (Story 3.5)
    // -- ne pas construire un tableau d'operations dynamique caste, cela ne
    // compile pas (TS2352, deja rencontre et documente dans la Story 3.5).
    const reservationAnnulee =
      autresConfirmees === 0
        ? (
            await this.prisma.$transaction([
              this.prisma.reservation.update({
                where: { id: reservation.id },
                data: { statut: 'annulee' },
              }),
            ])
          )[0]
        : (
            await this.prisma.$transaction([
              this.prisma.reservation.update({
                where: { id: reservation.id },
                data: { statut: 'annulee' },
              }),
              this.prisma.reservation.updateMany({
                where: { trajetId, statut: 'confirmee' },
                data: {
                  prixParPersonne: computePrixParPersonne(
                    reservation.trajet.prixTotal,
                    autresConfirmees,
                  ),
                },
              }),
            ])
          )[0];

    // Pas de livraison push reelle : meme limitation que Story 3.3/3.4/3.5.
    this.logger.log(
      `notification: reservation annulee par ${passagerId} sur le trajet ${trajetId}`,
    );

    return reservationAnnulee;
  }

  async signalerNoShow(passagerId: string, trajetId: string) {
    const trajet = await this.prisma.trajet.findUnique({
      where: { id: trajetId },
    });
    if (!trajet) {
      throw new NotFoundException('Trajet introuvable');
    }
    if (trajet.statut !== 'ouvert') {
      throw new ConflictException(
        'Seul un trajet "ouvert" peut etre signale comme no-show',
      );
    }
    if (trajet.heure.getTime() > Date.now()) {
      throw new ConflictException("L'heure de depart n'est pas encore passee");
    }

    const reservation = await this.prisma.reservation.findFirst({
      where: { trajetId, passagerId, statut: 'confirmee' },
    });
    if (!reservation) {
      throw new ForbiddenException(
        "Tu n'as pas de reservation confirmee sur ce trajet",
      );
    }

    const conducteur = await this.prisma.utilisateur.findUnique({
      where: { id: trajet.conducteurId },
    });

    const trajetUpdate = this.prisma.trajet.update({
      where: { id: trajetId },
      data: { statut: 'annule' },
    });

    // Meme structure a deux branches statiques que annulerTrajet/annulerReservation
    // (Stories 3.5/3.6) -- ne pas reconstruire un tableau unknown[] caste.
    const trajetAnnule =
      conducteur?.note === null || conducteur?.note === undefined
        ? (await this.prisma.$transaction([trajetUpdate]))[0]
        : (
            await this.prisma.$transaction([
              trajetUpdate,
              this.prisma.utilisateur.update({
                where: { id: trajet.conducteurId },
                data: {
                  note: Math.max(MIN_NOTE, conducteur.note - NO_SHOW_PENALTY),
                },
              }),
            ])
          )[0];

    // Retro-equipement Story 7.1 : un Signalement trace cet evenement --
    // sans lui, "annule" ne distingue pas un no-show d'une annulation
    // volontaire (annulerTrajet, Story 3.5). Aucun changement de
    // comportement existant (statut trajet, penalite, notifications).
    await this.prisma.signalement.create({
      data: {
        trajetId,
        type: 'no_show_conducteur',
        signaleParId: passagerId,
        concerneId: trajet.conducteurId,
      },
    });

    const passagers = await this.prisma.reservation.findMany({
      where: { trajetId, statut: 'confirmee' },
      select: { passagerId: true },
    });
    // Pas de livraison push reelle : meme limitation que Story 3.3/3.4/3.5/3.6.
    for (const { passagerId: destinataireId } of passagers) {
      this.logger.log(
        `notification: no-show conducteur signale sur le trajet ${trajetId} pour ${destinataireId}`,
      );
    }

    return trajetAnnule;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async envoyerRappelsDepart() {
    await this.envoyerRappelsPourSeuil('rappel2hEnvoye', REMINDER_2H_MS);
    await this.envoyerRappelsPourSeuil('rappel1hEnvoye', REMINDER_1H_MS);
  }

  private async envoyerRappelsPourSeuil(
    champ: 'rappel2hEnvoye' | 'rappel1hEnvoye',
    fenetreMs: number,
  ) {
    const maintenant = new Date();
    const trajets = await this.prisma.trajet.findMany({
      where: {
        statut: 'ouvert',
        [champ]: false,
        heure: {
          gt: maintenant,
          lte: new Date(maintenant.getTime() + fenetreMs),
        },
      },
      include: {
        reservations: {
          where: { statut: 'confirmee' },
          select: { passagerId: true },
        },
      },
    });

    for (const trajet of trajets) {
      const destinataires = [
        trajet.conducteurId,
        ...trajet.reservations.map((r) => r.passagerId),
      ];
      // Pas de livraison push reelle : meme limitation que Stories 3.3 a 3.7.
      for (const destinataireId of destinataires) {
        this.logger.log(
          `notification: rappel depart trajet ${trajet.id} (${champ}) pour ${destinataireId}`,
        );
      }
      await this.prisma.trajet.update({
        where: { id: trajet.id },
        data: { [champ]: true },
      });
    }
  }

  async listerMesReservations(passagerId: string) {
    const trajets = await this.prisma.trajet.findMany({
      where: {
        reservations: { some: { passagerId, statut: 'confirmee' } },
      },
      include: TRAJET_DETAIL_INCLUDE,
      orderBy: { heure: 'asc' },
    });

    return trajets.map((trajet) => ({
      ...trajet,
      // "Avant l'embarquement" (§12.1) -- le bouton Rencontre ne fait plus
      // sens des que le trajet a demarre, voir Story 5.1 Dev Notes.
      peutVoirRencontre: trajet.statut === 'ouvert',
    }));
  }

  // Factorise la garde d'eligibilite (reservation confirmee + trajet
  // "ouvert") partagee par getRencontre et getRencontrePhotoVehiculePath --
  // ce dernier ajoute en meme temps que la construction de l'ecran Rencontre
  // cote front_mobile, aucun endpoint accessible au passager ne servait
  // encore le fichier `photoVehicule` (le seul existant, Story 1.5, est
  // reserve a l'admin et scope a un `demandeId`, pas a un trajet/passager).
  private async verifierEligibiliteRencontre(
    passagerId: string,
    trajetId: string,
  ) {
    const trajet = await this.prisma.trajet.findUnique({
      where: { id: trajetId },
    });
    if (!trajet) {
      throw new NotFoundException('Trajet introuvable');
    }

    const reservation = await this.prisma.reservation.findFirst({
      where: { trajetId, passagerId, statut: 'confirmee' },
    });
    if (!reservation) {
      throw new ForbiddenException(
        "Tu n'as pas de reservation confirmee sur ce trajet",
      );
    }

    if (trajet.statut !== 'ouvert') {
      throw new ConflictException(
        "La rencontre n'est plus disponible pour ce trajet",
      );
    }

    const documents = await this.prisma.documentsConducteur.findFirst({
      where: { userId: trajet.conducteurId, statut: 'valide' },
      orderBy: { createdAt: 'desc' },
    });

    return { trajet, documents };
  }

  async getRencontre(passagerId: string, trajetId: string) {
    const { trajet, documents } = await this.verifierEligibiliteRencontre(
      passagerId,
      trajetId,
    );
    const conducteur = await this.prisma.utilisateur.findUniqueOrThrow({
      where: { id: trajet.conducteurId },
    });

    return {
      conducteur: {
        nom: conducteur.nom,
        prenom: conducteur.prenom,
        note: conducteur.note,
        verifie: true,
        matriculeVehicule: documents?.matriculeVehicule ?? null,
        photoVehicule: documents?.photoVehicule ?? null,
        motBienvenue: documents?.motBienvenue ?? null,
      },
    };
  }

  async getRencontrePhotoVehiculePath(
    passagerId: string,
    trajetId: string,
  ): Promise<string> {
    const { documents } = await this.verifierEligibiliteRencontre(
      passagerId,
      trajetId,
    );
    if (!documents?.photoVehicule) {
      throw new NotFoundException('Aucune photo de vehicule disponible');
    }

    return join(CONDUCTEUR_UPLOADS_DIR, documents.photoVehicule);
  }

  async signalerPassagerAbsent(
    conducteurId: string,
    trajetId: string,
    passagerId: string,
  ) {
    const trajet = await this.prisma.trajet.findUnique({
      where: { id: trajetId },
    });
    if (!trajet) {
      throw new NotFoundException('Trajet introuvable');
    }
    if (trajet.conducteurId !== conducteurId) {
      throw new ForbiddenException("Ce trajet ne t'appartient pas");
    }
    if (trajet.statut !== 'termine') {
      throw new ConflictException(
        'Seul un trajet "termine" permet de signaler une absence',
      );
    }

    const reservation = await this.prisma.reservation.findFirst({
      where: { trajetId, passagerId, statut: { in: ['confirmee', 'absent'] } },
    });
    if (!reservation) {
      throw new BadRequestException(
        "Ce passager n'etait pas inscrit sur ce trajet",
      );
    }
    if (reservation.statut === 'absent') {
      throw new ConflictException('Ce passager a deja ete signale absent');
    }

    const passager = await this.prisma.utilisateur.findUnique({
      where: { id: passagerId },
    });

    const reservationUpdate = this.prisma.reservation.update({
      where: { id: reservation.id },
      data: { statut: 'absent' },
    });

    // Meme structure a deux branches statiques que annulerTrajet/signalerNoShow
    // (Stories 3.5/3.7) -- ne pas reconstruire un tableau unknown[] caste.
    const reservationMiseAJour =
      passager?.note === null || passager?.note === undefined
        ? (await this.prisma.$transaction([reservationUpdate]))[0]
        : (
            await this.prisma.$transaction([
              reservationUpdate,
              this.prisma.utilisateur.update({
                where: { id: passagerId },
                data: {
                  note: Math.max(
                    MIN_NOTE,
                    passager.note - PASSAGER_NO_SHOW_PENALTY,
                  ),
                },
              }),
            ])
          )[0];

    // Retro-equipement Story 7.1 : meme raisonnement que signalerNoShow --
    // trace cet evenement independamment du statut "absent" deja mis sur la
    // Reservation. Aucun changement de comportement existant.
    await this.prisma.signalement.create({
      data: {
        trajetId,
        type: 'no_show_passager',
        signaleParId: conducteurId,
        concerneId: passagerId,
      },
    });

    return reservationMiseAJour;
  }

  async listerSignalements() {
    return this.prisma.signalement.findMany({
      include: {
        concerne: { select: { id: true, nom: true, prenom: true } },
        signalePar: { select: { id: true, nom: true, prenom: true } },
        trajet: { select: { id: true, heure: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async traiterSignalement(signalementId: string) {
    const signalement = await this.prisma.signalement.findUnique({
      where: { id: signalementId },
    });
    if (!signalement) {
      throw new NotFoundException('Signalement introuvable');
    }
    if (signalement.statut === 'traite') {
      throw new ConflictException('Ce signalement a deja ete traite');
    }

    return this.prisma.signalement.update({
      where: { id: signalementId },
      data: { statut: 'traite' },
    });
  }
}
