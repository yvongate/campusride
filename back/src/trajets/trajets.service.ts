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
import { aUneActiviteActive } from '../common/utils/activite-active';
import { verifierFenetreReservation } from '../common/utils/fenetre-reservation';
import { calculerSanctionAnnulationTardive } from '../common/utils/sanction-annulation';
import { distanceKm } from '../common/utils/haversine';
import { computeNote } from '../common/utils/note';
import { MessagerieService } from '../messagerie/messagerie.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CONDUCTEUR_UPLOADS_DIR } from '../users/conducteur-files.storage';
import { CreateTrajetDto } from './dto/create-trajet.dto';
import { ListTrajetsQueryDto } from './dto/list-trajets-query.dto';

const TRAJET_DETAIL_INCLUDE = {
  conducteur: { select: { id: true, nom: true, prenom: true, note: true, nombreNotations: true } },
  pointDeRdv: { include: { quartier: { include: { commune: true } } } },
  universite: true,
} as const;

// Seuil unique du domaine (v1.4) : 1h15 avant le depart. Tous les delais
// ci-dessous valaient 2h auparavant ; ils ont ete alignes sur la duree de vie
// d'une demande (DemandesService.EXPIRATION_DEADLINE_MS) pour supprimer la
// fenetre ou une demande encore acceptable placait deja ses passagers en zone
// d'annulation tardive. Les constantes restent separees (concepts distincts,
// voir Stories 3.1/3.5/3.6) meme si leur valeur coincide.
const SEUIL_AVANT_DEPART_MS = 75 * 60 * 1000;

// Aucune duree de trajet dans le modele (cahier des charges §13.2) -- fenetre
// de chevauchement pour un meme conducteur (§4.4).
const OVERLAP_WINDOW_MS = SEUIL_AVANT_DEPART_MS;

// Delai avant depart a partir duquel une annulation conducteur est consideree
// "tardive" (§8.3) -- constante separee volontairement, Story 3.5 Dev Notes.
const LATE_CANCELLATION_WINDOW_MS = SEUIL_AVANT_DEPART_MS;

// Aucune formule n'est donnee par le cahier des charges pour la baisse de
// note -- mecanisme simplifie et provisoire, voir Story 3.5 Dev Notes.
const LATE_CANCELLATION_PENALTY = 0.5;

// "La note du conducteur baisse fortement, de la meme maniere qu'une
// annulation tardive" (§8.2) -- meme mecanisme que LATE_CANCELLATION_PENALTY
// (Story 3.5), magnitude volontairement plus forte (voir Story 3.7 Dev Notes).
const NO_SHOW_PENALTY = 1.0;

// Delai avant depart en dessous duquel une annulation passager est consideree
// "tardive" (§8.2) -- constante separee volontairement, voir Story 3.6 Dev
// Notes (meme rationale que Story 3.5). Ne bloque plus l'annulation (bloquer
// n'empechait pas un no-show silencieux, ca le rendait juste invisible) : en
// dessous de ce delai, le trajet est annule pour tout le monde et
// l'annulation compte comme "tardive" pour le passager.
const PASSENGER_CANCELLATION_DEADLINE_MS = SEUIL_AVANT_DEPART_MS;

// Un trajet "ouvert" (depart jamais confirme) ou "commence" (arrivee jamais
// confirmee) restait bloque a vie dans cet etat si le conducteur oubliait le
// bouton correspondant -- et bloquait avec lui tous ses passagers, puisque
// aUneActiviteActive compte ces deux statuts comme actifs. Cloture
// automatique apres ce delai passe l'heure de depart. Le delai laisse assez
// de temps pour qu'un passager signale d'abord une absence conducteur
// (signalerNoShow exige statut "ouvert").
const CLOTURE_AUTOMATIQUE_MS = 4 * 60 * 60 * 1000;

// Rappels avant depart : le 1er coincide desormais avec la derniere minute
// pour annuler sans consequence (SEUIL_AVANT_DEPART_MS), ce qui lui donne un
// sens concret pour le passager. Le champ DB reste "rappel2hEnvoye" (nom
// historique, renommer la colonne n'apporterait rien).
const REMINDER_TARDIF_MS = SEUIL_AVANT_DEPART_MS;
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
    private readonly notifications: NotificationsService,
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
    // "les deux" = etudiant + conducteur valide ; "chauffeur" = conducteur
    // valide sans etre etudiant (aucune universite de rattachement, voir
    // Utilisateur.role et UsersService.validerDemandeConducteur).
    if (
      !conducteur ||
      (conducteur.role !== 'les deux' && conducteur.role !== 'chauffeur')
    ) {
      throw new ForbiddenException(
        "Ton compte conducteur n'est pas encore validé.",
      );
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
      throw new ConflictException('Tu as déjà un trajet prévu sur ce créneau.');
    }
  }

  async publierTrajet(conducteurId: string, dto: CreateTrajetDto) {
    const universite = await this.prisma.universite.findUnique({
      where: { id: dto.universiteId },
    });
    if (!universite) {
      throw new BadRequestException('Cette université est introuvable.');
    }

    const pointDeRdv = await this.prisma.pointInteret.findUnique({
      where: { id: dto.pointDeRdvId },
    });
    if (!pointDeRdv) {
      throw new BadRequestException('Ce point de rendez-vous est introuvable.');
    }

    const heure = new Date(dto.heure);
    verifierFenetreReservation(heure);
    await this.verifierConducteurEtChevauchement(conducteurId, heure);

    // Un seul trajet/demande actif a la fois, tous roles confondus -- voir
    // aUneActiviteActive (meme regle que creerDemande/rejoindreDemande/
    // reserverTrajet/accepterDemande).
    if (await aUneActiviteActive(this.prisma, conducteurId)) {
      throw new ConflictException(
        "Tu as déjà une activité en cours (trajet ou demande). Termine-la avant d'en publier un nouveau.",
      );
    }

    return this.prisma.trajet.create({
      data: {
        conducteurId,
        universiteId: dto.universiteId,
        pointDeRdvId: dto.pointDeRdvId,
        heure,
        places: dto.places,
        cotisation: dto.cotisation,
        mode: 'B',
        statut: 'ouvert',
      },
    });
  }

  async listerTrajets(query: ListTrajetsQueryDto, userId: string) {
    const trajets = await this.prisma.trajet.findMany({
      where: {
        universiteId: query.universiteId,
        statut: 'ouvert',
        // Sans ce filtre, un trajet deja parti restait affiche -- et comme le
        // tri est par heure croissante, il remontait meme EN TETE de liste.
        // Le statut ne suffit pas : un trajet ayant des passagers reste
        // "ouvert" tant que le conducteur n'a pas confirme le depart.
        heure: { gt: new Date() },
        pointDeRdv: { quartier: { communeId: query.communeId } },
      },
      include: {
        pointDeRdv: { include: { quartier: { include: { commune: true } } } },
        conducteur: {
          select: { id: true, nom: true, prenom: true, note: true, nombreNotations: true },
        },
        universite: true,
        reservations: {
          where: { statut: 'confirmee' },
          select: { passagerId: true },
        },
      },
      // Trie par heure par defaut ; si lat/lng sont fournis, le tri par
      // distance (calcul non supporte par Prisma) remplace celui-ci ci-dessous.
      orderBy: { heure: 'asc' },
    });

    // Un trajet deja complet n'a plus rien a proposer a un nouveau passager
    // -- contrairement a Demande (qui transite automatiquement vers
    // "quota_atteint", voir DemandesService.verifierQuotaEtCalculerPoint),
    // Trajet.statut reste "ouvert" jusqu'a ce que le conducteur demarre/
    // annule, donc ce filtre doit etre fait ici, pas via le statut.
    const disponibles = trajets.filter(
      (trajet) => trajet.reservations.length < trajet.places,
    );

    const withVerifieEtDejaReserve = disponibles.map((trajet) => {
      const { reservations, ...rest } = trajet;
      return {
        ...rest,
        conducteur: { ...trajet.conducteur, verifie: true },
        // Meme raisonnement que Demande.dejaRejoint (listerDemandes) : le
        // front doit pouvoir afficher "deja reserve" au lieu de "Reserver"
        // pour un trajet ou l'utilisateur a deja une reservation confirmee.
        dejaReserve: reservations.some((r) => r.passagerId === userId),
      };
    });

    if (query.lat === undefined || query.lng === undefined) {
      return withVerifieEtDejaReserve;
    }

    const lat = query.lat;
    const lng = query.lng;
    return withVerifieEtDejaReserve
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

  async getTrajetDetail(id: string, userId: string) {
    const trajet = await this.prisma.trajet.findUnique({
      where: { id },
      include: TRAJET_DETAIL_INCLUDE,
    });
    if (!trajet) {
      throw new NotFoundException('Ce trajet est introuvable.');
    }

    const reservationsConfirmees = await this.countReservationsConfirmees(id);
    const placesDisponibles = trajet.places - reservationsConfirmees;
    // Meme raisonnement que listerTrajets/Demande.dejaRejoint : le front doit
    // pouvoir afficher "Trajet deja reserve" au lieu de proposer a nouveau la
    // reservation quand cet ecran est atteint autrement que depuis le feed
    // (ex. "Mes trajets", lien direct).
    const dejaReserve = Boolean(
      await this.prisma.reservation.findFirst({
        where: { trajetId: id, passagerId: userId, statut: 'confirmee' },
      }),
    );

    return {
      ...trajet,
      conducteur: { ...trajet.conducteur, verifie: true },
      placesDisponibles,
      dejaReserve,
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
      throw new NotFoundException('Ce trajet est introuvable.');
    }
    if (trajet.statut !== 'ouvert') {
      throw new ConflictException("Ce trajet n'est plus disponible.");
    }
    // Le statut ne suffit pas : un trajet dont l'heure est passee reste
    // "ouvert" tant que le conducteur n'a pas confirme le depart. Sans cette
    // garde, on pouvait reserver un trajet deja parti et se retrouver
    // immediatement en zone d'annulation tardive (donc sanctionnable).
    if (trajet.heure.getTime() <= Date.now()) {
      throw new ConflictException('Ce trajet est déjà parti.');
    }
    if (trajet.conducteurId === passagerId) {
      throw new ForbiddenException('Tu ne peux pas réserver ton propre trajet.');
    }

    // Un seul trajet/demande actif a la fois, tous roles confondus -- voir
    // aUneActiviteActive.
    if (await aUneActiviteActive(this.prisma, passagerId)) {
      throw new ConflictException(
        "Tu as déjà une activité en cours. Termine-la avant d'en rejoindre une autre.",
      );
    }

    const dejaReserve = await this.prisma.reservation.findFirst({
      where: { trajetId, passagerId, statut: 'confirmee' },
    });
    if (dejaReserve) {
      throw new ConflictException('Tu as déjà réservé ce trajet.');
    }

    // Comptage ET creation dans la meme transaction serialisable : en
    // "compter puis creer" hors transaction, deux passagers prenant la
    // derniere place au meme instant passaient tous les deux le test et le
    // trajet se retrouvait surreserve.
    const reservation = await this.prisma.$transaction(
      async (tx) => {
        const existingCount = await tx.reservation.count({
          where: { trajetId, statut: 'confirmee' },
        });
        if (existingCount >= trajet.places) {
          throw new ConflictException('Ce trajet est complet.');
        }

        // Montant fige : chaque passager doit la cotisation annoncee par le
        // conducteur, quel que soit le nombre final de reservants. Plus
        // aucune resynchronisation des reservations existantes (§6).
        return tx.reservation.create({
          data: {
            trajetId,
            passagerId,
            prixParPersonne: trajet.cotisation,
            statut: 'confirmee',
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );

    await this.notifications.envoyer(
      [passagerId],
      'Réservation confirmée',
      `Ta place est réservée pour ${trajet.cotisation} FCFA. Rendez-vous à l'heure prévue.`,
      { type: 'trajet', id: trajetId },
    );
    // Le conducteur doit savoir que sa voiture se remplit (§9) -- il n'etait
    // prevenu de rien jusqu'ici.
    await this.notifications.envoyer(
      [trajet.conducteurId],
      'Nouvelle réservation',
      'Un passager vient de réserver une place sur ton trajet.',
      { type: 'trajet', id: trajetId },
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
      throw new NotFoundException('Ce trajet est introuvable.');
    }
    if (trajet.conducteurId !== conducteurId) {
      throw new ForbiddenException("Ce trajet ne t'appartient pas.");
    }
    if (trajet.statut !== statutActuel) {
      throw new ConflictException(
        `Cette action est impossible : le trajet est "${statutActuel}".`,
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
      throw new NotFoundException('Ce trajet est introuvable.');
    }
    if (trajet.conducteurId !== conducteurId) {
      throw new ForbiddenException("Ce trajet ne t'appartient pas.");
    }
    if (trajet.statut !== 'ouvert') {
      throw new ConflictException('Seul un trajet "ouvert" peut être annulé.');
    }

    const passagers = await this.prisma.reservation.findMany({
      where: { trajetId, statut: 'confirmee' },
      select: { passagerId: true },
    });

    // Une annulation tardive n'est penalisee que si elle laisse reellement
    // quelqu'un sur le carreau. Un conducteur qui retire une annonce que
    // PERSONNE n'a reservee ne cause aucun tort : le sanctionner revenait a
    // punir le simple fait d'avoir essaye de proposer un trajet -- et
    // decourageait exactement le comportement qu'on cherche a encourager.
    // Meme principe que l'annulation d'une demande sans participant
    // (DemandesService.annulerDemande), qui n'a jamais ete sanctionnee.
    const estTardive =
      passagers.length > 0 &&
      trajet.heure.getTime() - Date.now() < LATE_CANCELLATION_WINDOW_MS;

    // La note doit etre lue avant la transaction pour calculer la nouvelle
    // valeur, mais l'ecriture du trajet et celle de la note doivent rester
    // atomiques -- toutes deux dans le meme $transaction (voir Story 3.5,
    // ne pas laisser deux ecritures sequentielles non liees).
    let nouvellePenalite: { penaliteCumulee: number; note: number | null } | undefined;
    if (estTardive) {
      const conducteur = await this.prisma.utilisateur.findUnique({
        where: { id: conducteurId },
      });
      if (conducteur) {
        const penaliteCumulee =
          conducteur.penaliteCumulee + LATE_CANCELLATION_PENALTY;
        nouvellePenalite = {
          penaliteCumulee,
          note: computeNote(conducteur.noteBrute, penaliteCumulee),
        };
      }
    }

    const trajetUpdate = this.prisma.trajet.update({
      where: { id: trajetId },
      data: { statut: 'annule' },
    });

    const trajetAnnule =
      nouvellePenalite === undefined
        ? (await this.prisma.$transaction([trajetUpdate]))[0]
        : (
            await this.prisma.$transaction([
              trajetUpdate,
              this.prisma.utilisateur.update({
                where: { id: conducteurId },
                data: nouvellePenalite,
              }),
            ])
          )[0];

    // "Dans le Mode A, la demande redevient visible pour d'autres
    // conducteurs" (§8.3) -- le groupe est intact, seul le conducteur se
    // desiste.
    await this.traiterDemandeLieeAnnulation(trajetId, 'rouvrir');

    // Liste deja lue plus haut (elle conditionne la penalite).
    await this.notifications.envoyer(
      passagers.map((p) => p.passagerId),
      'Trajet annulé',
      "Le conducteur a annulé ce trajet. Tu peux en chercher un autre dès maintenant.",
      { type: 'trajet', id: trajetId },
    );

    return trajetAnnule;
  }

  async annulerReservation(passagerId: string, trajetId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { trajetId, passagerId, statut: 'confirmee' },
      include: { trajet: true },
    });
    if (!reservation) {
      throw new NotFoundException('Cette réservation est introuvable.');
    }

    const delaiRestant = reservation.trajet.heure.getTime() - Date.now();
    if (delaiRestant < PASSENGER_CANCELLATION_DEADLINE_MS) {
      return this.annulerReservationTardive(passagerId, reservation);
    }

    // Simple liberation de place : plus aucune resynchronisation de prix. La
    // cotisation etant due par personne (§6), le depart d'un passager ne doit
    // rien changer pour les autres -- auparavant, ils se retrouvaient a payer
    // davantage que le montant qu'ils avaient accepte en reservant.
    const reservationAnnulee = await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: { statut: 'annulee' },
    });

    // Le conducteur doit savoir qu'une place s'est liberee (§9) -- jusqu'ici
    // seule l'annulation etait journalisee, personne n'etait prevenu.
    await this.notifications.envoyer(
      [reservation.trajet.conducteurId],
      'Un passager a annulé',
      'Une place vient de se libérer sur ton trajet.',
      { type: 'trajet', id: trajetId },
    );

    // Meme forme de reponse que la branche tardive : le front doit pouvoir
    // distinguer les deux cas sans deviner a partir de l'heure.
    return {
      ...reservationAnnulee,
      trajetAnnule: false,
      suspenduJusqua: null,
    };
  }

  // §8.2 mis a jour : une annulation a moins de 2h du depart n'est plus
  // bloquee, mais elle annule le trajet pour tout le monde (impossible de
  // retrouver un passager de remplacement a temps) et compte comme une
  // "annulation tardive" pour le passager -- la 1re est toleree, la 2e
  // suspend son compte trois semaines ET remet le compteur a 0 (cycle "2
  // essais" qui recommence a chaque fois, plutot qu'un compteur a vie qui
  // suspendrait automatiquement a chaque nouvelle annulation tardive apres
  // la 1re suspension). Le createur d'une demande qui a ete acceptee (statut
  // "acceptee" -> Trajet + Reservation crees, voir
  // DemandesService.accepterDemande) est lui aussi un passager comme les
  // autres a ce stade : meme methode, meme sanction, aucune distinction.
  private async annulerReservationTardive(
    passagerId: string,
    reservation: {
      id: string;
      trajetId: string;
      trajet: { conducteurId: string };
    },
  ) {
    const sanction = await calculerSanctionAnnulationTardive(
      this.prisma,
      passagerId,
    );
    const { suspenduJusqua } = sanction;

    // Les autres passagers sont lus AVANT la transaction : une fois le trajet
    // annule, on veut quand meme savoir qui prevenir.
    const autresPassagers = await this.prisma.reservation.findMany({
      where: {
        trajetId: reservation.trajetId,
        statut: 'confirmee',
        passagerId: { not: passagerId },
      },
      select: { passagerId: true },
    });

    // Meme structure a deux branches statiques que annulerTrajet/
    // annulerReservation (Stories 3.5/3.6) -- ne pas construire un tableau
    // d'operations dynamique caste, cela ne compile pas (TS2352).
    const [reservationAnnulee] = await this.prisma.$transaction([
      // Sans cette ligne, la reservation restait "confirmee" sur un trajet
      // annule : celui qui annulait figurait toujours comme passager
      // confirme, et la methode retournait un objet fabrique qui mentait sur
      // l'etat reel en base (incoherent avec la branche non tardive).
      this.prisma.reservation.update({
        where: { id: reservation.id },
        data: { statut: 'annulee' },
      }),
      this.prisma.trajet.update({
        where: { id: reservation.trajetId },
        data: { statut: 'annule' },
      }),
      this.prisma.utilisateur.update({
        where: { id: passagerId },
        data: sanction.data,
      }),
    ]);

    // Groupe casse (un participant se retire au dernier moment) -- contrairement
    // a une annulation conducteur, la demande n'est pas reproposee.
    await this.traiterDemandeLieeAnnulation(reservation.trajetId, 'annuler');

    // Tout le monde perd le trajet, conducteur compris : c'est la
    // consequence assumee d'une annulation a moins de 1h15 (§8.2).
    await this.notifications.envoyer(
      [
        ...autresPassagers.map((p) => p.passagerId),
        reservation.trajet.conducteurId,
      ],
      'Trajet annulé',
      "Un passager s'est désisté trop tard pour être remplacé : le trajet est annulé.",
      { type: 'trajet', id: reservation.trajetId },
    );

    if (suspenduJusqua) {
      await this.notifications.envoyer(
        [passagerId],
        'Compte suspendu',
        `Suite à une 2e annulation tardive, ton compte est suspendu jusqu'au ${suspenduJusqua.toLocaleDateString('fr-FR')}.`,
        { type: 'compte' },
      );
    }

    // La suspension est renvoyee dans la reponse de l'annulation elle-meme :
    // sans ca, le front n'apprenait la sanction qu'au 401 de la requete
    // suivante, qui le deconnectait sans le moindre message (il ne comprenait
    // qu'en retentant un OTP). Ici il peut expliquer avant de deconnecter.
    return {
      ...reservationAnnulee,
      trajetAnnule: true,
      suspenduJusqua,
    };
  }

  // Mode A : une Demande acceptee reste figee sur "acceptee" et pointe vers
  // son Trajet. Quand ce Trajet est annule, il faut trancher son sort, sinon
  // elle reste affichee "Conducteur trouve" a vie cote passagers
  // (MesTrajetsPassagerScreen classe "acceptee" dans "En cours") et n'est
  // plus proposable a personne (listerDemandesDisponibles exige
  // "quota_atteint").
  // - "rouvrir" : le conducteur s'est desiste alors que le groupe est intact
  //   -- la demande redevient disponible pour un autre conducteur (§8.3).
  // - "annuler" : le groupe lui-meme est casse (desistement d'un passager,
  //   heure depassee) -- la reproposer n'aurait pas de sens.
  private async traiterDemandeLieeAnnulation(
    trajetId: string,
    issue: 'rouvrir' | 'annuler',
  ) {
    const demande = await this.prisma.demande.findUnique({
      where: { trajetId },
    });
    if (!demande || demande.statut !== 'acceptee') {
      return;
    }

    await this.prisma.demande.update({
      where: { id: demande.id },
      // trajetId libere a la reouverture : accepterDemande le reecrira avec
      // le nouveau Trajet (la colonne est @unique).
      data:
        issue === 'rouvrir'
          ? { statut: 'quota_atteint', trajetId: null }
          : { statut: 'annulee' },
    });
    this.logger.log(
      `demande ${demande.id} ${issue === 'rouvrir' ? 'reproposee aux conducteurs' : 'annulee'} suite a l'annulation du trajet ${trajetId}`,
    );
  }

  async signalerNoShow(passagerId: string, trajetId: string) {
    const trajet = await this.prisma.trajet.findUnique({
      where: { id: trajetId },
    });
    if (!trajet) {
      throw new NotFoundException('Ce trajet est introuvable.');
    }
    if (trajet.statut !== 'ouvert') {
      throw new ConflictException(
        'Seul un trajet "ouvert" peut être signalé comme absence.',
      );
    }
    if (trajet.heure.getTime() > Date.now()) {
      throw new ConflictException("L'heure de départ n'est pas encore passée.");
    }

    const reservation = await this.prisma.reservation.findFirst({
      where: { trajetId, passagerId, statut: 'confirmee' },
    });
    if (!reservation) {
      throw new ForbiddenException(
        "Tu n'as pas de réservation confirmée sur ce trajet.",
      );
    }

    const conducteur = await this.prisma.utilisateur.findUnique({
      where: { id: trajet.conducteurId },
    });

    const trajetUpdate = this.prisma.trajet.update({
      where: { id: trajetId },
      data: { statut: 'annule' },
    });

    const penaliteCumulee = conducteur
      ? conducteur.penaliteCumulee + NO_SHOW_PENALTY
      : undefined;

    // Meme structure a deux branches statiques que annulerTrajet/annulerReservation
    // (Stories 3.5/3.6) -- ne pas reconstruire un tableau unknown[] caste.
    const trajetAnnule =
      conducteur === null || penaliteCumulee === undefined
        ? (await this.prisma.$transaction([trajetUpdate]))[0]
        : (
            await this.prisma.$transaction([
              trajetUpdate,
              this.prisma.utilisateur.update({
                where: { id: trajet.conducteurId },
                data: {
                  penaliteCumulee,
                  note: computeNote(conducteur.noteBrute, penaliteCumulee),
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

    // Meme raisonnement que l'annulation conducteur (§8.3) : le groupe est
    // intact, c'est le conducteur qui a fait defaut -- la demande Mode A
    // repart a la recherche d'un autre conducteur.
    await this.traiterDemandeLieeAnnulation(trajetId, 'rouvrir');

    const passagers = await this.prisma.reservation.findMany({
      where: { trajetId, statut: 'confirmee' },
      select: { passagerId: true },
    });
    await this.notifications.envoyer(
      passagers.map((p) => p.passagerId),
      'Trajet annulé',
      "L'absence du conducteur a été signalée : ce trajet est annulé.",
      { type: 'trajet', id: trajetId },
    );

    return trajetAnnule;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async envoyerRappelsDepart() {
    await this.envoyerRappelsPourSeuil('rappel2hEnvoye', REMINDER_TARDIF_MS);
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
      // Le 1er rappel coincide avec la derniere minute pour annuler sans
      // consequence (SEUIL_AVANT_DEPART_MS) : le message le dit explicitement,
      // c'est ce qui lui donne son interet.
      await this.notifications.envoyer(
        destinataires,
        'Départ bientôt',
        champ === 'rappel2hEnvoye'
          ? "Ton trajet part dans 1h15. C'est le dernier moment pour annuler sans conséquence."
          : 'Ton trajet part dans 1 heure.',
        { type: 'trajet', id: trajet.id },
      );
      await this.prisma.trajet.update({
        where: { id: trajet.id },
        data: { [champ]: true },
      });
    }
  }

  // Un Trajet Mode B n'a pas de notion de quota -- le conducteur peut partir
  // avec 1 passager sur 4 places, ou 0, rien ne l'oblige a se remplir
  // (contrairement a une Demande, voir DemandesService.expirerDemandesEnRetard).
  // Sans ce cron, un Trajet jamais reserve restait "ouvert" pour toujours
  // meme longtemps apres son heure de depart, ce qui bloquait aussi son
  // conducteur via aUneActiviteActive (un seul trajet/demande actif a la
  // fois) -- il ne pouvait plus rien publier ni accepter. Restreint aux
  // Trajets sans aucune reservation confirmee : un Trajet avec des passagers
  // reste gere manuellement (demarrerTrajet/annulerTrajet/signalerNoShow),
  // pas d'annulation automatique qui les affecterait sans notification.
  @Cron(CronExpression.EVERY_MINUTE)
  async expirerTrajetsSansPassager() {
    const trajets = await this.prisma.trajet.findMany({
      where: {
        statut: 'ouvert',
        heure: { lte: new Date() },
        reservations: { none: { statut: 'confirmee' } },
      },
    });

    for (const trajet of trajets) {
      await this.prisma.trajet.update({
        where: { id: trajet.id },
        data: { statut: 'annule' },
      });
      this.logger.log(
        `trajet ${trajet.id} expire automatiquement (aucun passager, heure de depart passee)`,
      );
      // Aucun passager a prevenir par definition, mais le conducteur doit
      // savoir que son annonce est retiree -- sinon elle disparait sans un
      // mot alors qu'il attendait peut-etre encore des reservations.
      await this.notifications.envoyer(
        [trajet.conducteurId],
        'Trajet retiré',
        "Personne n'a réservé avant l'heure de départ : ton trajet a été retiré.",
        { type: 'trajet', id: trajet.id },
      );
    }
  }

  // Filet de securite contre l'oubli des boutons "Confirmer le depart" /
  // "Marquer comme termine" : sans cloture, un trajet restait "ouvert" ou
  // "commence" a vie, et comme aUneActiviteActive compte ces deux statuts
  // comme actifs, il gelait definitivement le conducteur ET tous ses
  // passagers (plus aucune creation/reservation possible). L'unique
  // echappatoire etait signalerNoShow, qui punit un conducteur pourtant
  // present. Delai volontairement large (CLOTURE_AUTOMATIQUE_MS) pour laisser
  // le temps d'un vrai signalement d'absence avant de trancher.
  @Cron(CronExpression.EVERY_MINUTE)
  async cloturerTrajetsEnRetard() {
    const seuil = new Date(Date.now() - CLOTURE_AUTOMATIQUE_MS);
    const trajets = await this.prisma.trajet.findMany({
      where: {
        statut: { in: ['ouvert', 'commence'] },
        heure: { lte: seuil },
      },
      select: {
        id: true,
        statut: true,
        conducteurId: true,
        reservations: {
          where: { statut: 'confirmee' },
          select: { passagerId: true },
        },
      },
    });

    for (const trajet of trajets) {
      // "commence" => le trajet a bien eu lieu, seule la cloture manque :
      // on le termine (ce qui ouvre la notation et supprime le chat, §10).
      // "ouvert" => le depart n'a jamais ete confirme, rien ne prouve que le
      // trajet a eu lieu : on l'annule plutot que de le marquer termine, ce
      // qui declencherait des demandes de notation entre gens qui n'ont
      // peut-etre jamais voyage ensemble.
      const statutCible = trajet.statut === 'commence' ? 'termine' : 'annule';
      await this.prisma.trajet.update({
        where: { id: trajet.id },
        data: { statut: statutCible },
      });
      if (statutCible === 'termine') {
        await this.messagerieService.supprimerChatTrajet(trajet.id);
      } else {
        await this.traiterDemandeLieeAnnulation(trajet.id, 'annuler');
      }
      this.logger.log(
        `trajet ${trajet.id} cloture automatiquement en "${statutCible}" (heure de depart largement depassee)`,
      );
      // Conducteur ET passagers : la cloture change ce qu'ils peuvent faire
      // (notation ouverte si termine, trajet perdu si annule). Sans message,
      // le trajet changeait d'etat sans que personne ne comprenne pourquoi.
      await this.notifications.envoyer(
        [trajet.conducteurId, ...trajet.reservations.map((r) => r.passagerId)],
        statutCible === 'termine' ? 'Trajet terminé' : 'Trajet annulé',
        statutCible === 'termine'
          ? 'Ton trajet a été clôturé automatiquement. Tu peux maintenant noter les autres participants.'
          : "Le départ n'a jamais été confirmé : ce trajet a été annulé automatiquement.",
        { type: 'trajet', id: trajet.id },
      );
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
      throw new NotFoundException('Ce trajet est introuvable.');
    }

    const reservation = await this.prisma.reservation.findFirst({
      where: { trajetId, passagerId, statut: 'confirmee' },
    });
    if (!reservation) {
      throw new ForbiddenException(
        "Tu n'as pas de réservation confirmée sur ce trajet.",
      );
    }

    if (trajet.statut !== 'ouvert') {
      throw new ConflictException(
        "La rencontre n'est plus disponible pour ce trajet.",
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
        nombreNotations: conducteur.nombreNotations,
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
      throw new NotFoundException('Aucune photo de véhicule disponible.');
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
      throw new NotFoundException('Ce trajet est introuvable.');
    }
    if (trajet.conducteurId !== conducteurId) {
      throw new ForbiddenException("Ce trajet ne t'appartient pas.");
    }
    if (trajet.statut !== 'termine') {
      throw new ConflictException(
        'Seul un trajet "terminé" permet de signaler une absence.',
      );
    }

    const reservation = await this.prisma.reservation.findFirst({
      where: { trajetId, passagerId, statut: { in: ['confirmee', 'absent'] } },
    });
    if (!reservation) {
      throw new BadRequestException(
        "Ce passager n'était pas inscrit sur ce trajet.",
      );
    }
    if (reservation.statut === 'absent') {
      throw new ConflictException('Ce passager a déjà été signalé absent.');
    }

    const passager = await this.prisma.utilisateur.findUnique({
      where: { id: passagerId },
    });

    const reservationUpdate = this.prisma.reservation.update({
      where: { id: reservation.id },
      data: { statut: 'absent' },
    });

    const passagerPenaliteCumulee = passager
      ? passager.penaliteCumulee + PASSAGER_NO_SHOW_PENALTY
      : undefined;

    // Meme structure a deux branches statiques que annulerTrajet/signalerNoShow
    // (Stories 3.5/3.7) -- ne pas reconstruire un tableau unknown[] caste.
    const reservationMiseAJour =
      passager === null || passagerPenaliteCumulee === undefined
        ? (await this.prisma.$transaction([reservationUpdate]))[0]
        : (
            await this.prisma.$transaction([
              reservationUpdate,
              this.prisma.utilisateur.update({
                where: { id: passagerId },
                data: {
                  penaliteCumulee: passagerPenaliteCumulee,
                  note: computeNote(
                    passager.noteBrute,
                    passagerPenaliteCumulee,
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

    // Une sanction silencieuse est incomprehensible : le passager voyait sa
    // note baisser sans jamais savoir pourquoi ni qu'il pouvait contester.
    await this.notifications.envoyer(
      [passagerId],
      'Absence signalée',
      "Le conducteur t'a signalé absent sur un trajet terminé. Ta note a été ajustée.",
      { type: 'trajet', id: trajetId },
    );

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
      throw new NotFoundException('Ce signalement est introuvable.');
    }
    if (signalement.statut === 'traite') {
      throw new ConflictException('Ce signalement a déjà été traité.');
    }

    return this.prisma.signalement.update({
      where: { id: signalementId },
      data: { statut: 'traite' },
    });
  }
}
