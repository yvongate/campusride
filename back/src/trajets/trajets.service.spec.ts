import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { join } from 'path';
import { TrajetsService } from './trajets.service';
import { MessagerieService } from '../messagerie/messagerie.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CONDUCTEUR_UPLOADS_DIR } from '../users/conducteur-files.storage';

describe('TrajetsService', () => {
  let service: TrajetsService;
  let universiteFindUniqueMock: jest.Mock;
  let poiFindUniqueMock: jest.Mock;
  let utilisateurFindUniqueMock: jest.Mock;
  let trajetFindFirstMock: jest.Mock;
  let trajetCreateMock: jest.Mock;
  let trajetFindManyMock: jest.Mock;
  let trajetFindUniqueMock: jest.Mock;
  let demandeFindFirstMock: jest.Mock;
  let demandeFindUniqueMock: jest.Mock;
  let demandeUpdateMock: jest.Mock;
  let participationFindFirstMock: jest.Mock;
  let reservationCountMock: jest.Mock;
  let reservationFindFirstMock: jest.Mock;
  let reservationCreateMock: jest.Mock;
  let reservationUpdateManyMock: jest.Mock;
  let reservationUpdateMock: jest.Mock;
  let transactionMock: jest.Mock;
  let trajetUpdateMock: jest.Mock;
  let reservationFindManyMock: jest.Mock;
  let utilisateurUpdateMock: jest.Mock;
  let utilisateurFindUniqueOrThrowMock: jest.Mock;
  let documentsConducteurFindFirstMock: jest.Mock;
  let supprimerChatTrajetMock: jest.Mock;
  let signalementCreateMock: jest.Mock;
  let signalementFindManyMock: jest.Mock;
  let signalementFindUniqueMock: jest.Mock;
  let signalementUpdateMock: jest.Mock;

  // Toujours "demain a midi UTC" par rapport a l'execution du test --
  // verifierFenetreReservation (publierTrajet) n'accepte plus qu'aujourd'hui
  // ou demain, une date fixe en dur casserait des que "demain" serait passe.
  function demain(): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(12, 0, 0, 0);
    return d.toISOString();
  }

  const validDto = {
    universiteId: 'univ-1',
    pointDeRdvId: 'poi-1',
    heure: demain(),
    places: 3,
    cotisation: 875,
  };

  // Les notifications sont un effet de bord : les tests verifient le
  // comportement metier, pas les envois (couverts par notifications.service.spec).
  const notificationsMock = { envoyer: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    notificationsMock.envoyer.mockClear();
    universiteFindUniqueMock = jest.fn();
    poiFindUniqueMock = jest.fn();
    utilisateurFindUniqueMock = jest.fn();
    trajetFindFirstMock = jest.fn();
    trajetCreateMock = jest.fn();
    trajetFindManyMock = jest.fn();
    trajetFindUniqueMock = jest.fn();
    demandeFindFirstMock = jest.fn().mockResolvedValue(null);
    // Par defaut, aucun Trajet n'est issu d'une Demande Mode A --
    // traiterDemandeLieeAnnulation ne fait alors rien.
    demandeFindUniqueMock = jest.fn().mockResolvedValue(null);
    demandeUpdateMock = jest.fn();
    participationFindFirstMock = jest.fn().mockResolvedValue(null);
    reservationCountMock = jest.fn();
    reservationFindFirstMock = jest.fn();
    reservationCreateMock = jest.fn();
    reservationUpdateManyMock = jest.fn();
    reservationUpdateMock = jest.fn();
    // Polymorphe : la plupart des methodes passent un tableau statique
    // d'operations, mais reserverTrajet utilise une transaction interactive
    // (comptage + creation atomiques, garde-fou anti-surreservation).
    transactionMock = jest.fn(
      (
        arg:
          | ((tx: {
              reservation: { count: jest.Mock; create: jest.Mock };
            }) => Promise<unknown>)
          | Promise<unknown>[],
      ) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        return arg({
          reservation: {
            count: reservationCountMock,
            create: reservationCreateMock,
          },
        });
      },
    );
    trajetUpdateMock = jest.fn();
    reservationFindManyMock = jest.fn().mockResolvedValue([]);
    utilisateurUpdateMock = jest.fn();
    utilisateurFindUniqueOrThrowMock = jest.fn();
    documentsConducteurFindFirstMock = jest.fn();
    supprimerChatTrajetMock = jest.fn().mockResolvedValue(undefined);
    signalementCreateMock = jest.fn().mockResolvedValue({});
    signalementFindManyMock = jest.fn();
    signalementFindUniqueMock = jest.fn();
    signalementUpdateMock = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        TrajetsService,
        { provide: NotificationsService, useValue: notificationsMock },
        {
          provide: PrismaService,
          useValue: {
            universite: { findUnique: universiteFindUniqueMock },
            pointInteret: { findUnique: poiFindUniqueMock },
            demande: {
              findFirst: demandeFindFirstMock,
              findUnique: demandeFindUniqueMock,
              update: demandeUpdateMock,
            },
            participation: { findFirst: participationFindFirstMock },
            utilisateur: {
              findUnique: utilisateurFindUniqueMock,
              update: utilisateurUpdateMock,
              findUniqueOrThrow: utilisateurFindUniqueOrThrowMock,
            },
            documentsConducteur: {
              findFirst: documentsConducteurFindFirstMock,
            },
            signalement: {
              create: signalementCreateMock,
              findMany: signalementFindManyMock,
              findUnique: signalementFindUniqueMock,
              update: signalementUpdateMock,
            },
            trajet: {
              findFirst: trajetFindFirstMock,
              create: trajetCreateMock,
              findMany: trajetFindManyMock,
              findUnique: trajetFindUniqueMock,
              update: trajetUpdateMock,
            },
            reservation: {
              count: reservationCountMock,
              findFirst: reservationFindFirstMock,
              create: reservationCreateMock,
              update: reservationUpdateMock,
              updateMany: reservationUpdateManyMock,
              findMany: reservationFindManyMock,
            },
            $transaction: transactionMock,
          },
        },
        {
          provide: MessagerieService,
          useValue: { supprimerChatTrajet: supprimerChatTrajetMock },
        },
      ],
    }).compile();

    service = moduleRef.get(TrajetsService);
  });

  it('publishes a trajet when all checks pass', async () => {
    universiteFindUniqueMock.mockResolvedValueOnce({ id: 'univ-1' });
    poiFindUniqueMock.mockResolvedValueOnce({ id: 'poi-1' });
    utilisateurFindUniqueMock.mockResolvedValueOnce({
      id: 'conducteur-1',
      role: 'les deux',
    });
    trajetFindFirstMock.mockResolvedValueOnce(null);
    trajetCreateMock.mockResolvedValueOnce({ id: 'trajet-1' });

    const result = await service.publierTrajet('conducteur-1', validDto);

    expect(trajetCreateMock).toHaveBeenCalledWith({
      data: {
        conducteurId: 'conducteur-1',
        universiteId: 'univ-1',
        pointDeRdvId: 'poi-1',
        heure: new Date(validDto.heure),
        places: 3,
        cotisation: 875,
        mode: 'B',
        statut: 'ouvert',
      },
    });
    expect(result).toEqual({ id: 'trajet-1' });
  });

  it('throws BadRequestException when the universite does not exist', async () => {
    universiteFindUniqueMock.mockResolvedValueOnce(null);

    await expect(
      service.publierTrajet('conducteur-1', validDto),
    ).rejects.toThrow(BadRequestException);
    expect(poiFindUniqueMock).not.toHaveBeenCalled();
    expect(trajetCreateMock).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when the point de rendez-vous does not exist', async () => {
    universiteFindUniqueMock.mockResolvedValueOnce({ id: 'univ-1' });
    poiFindUniqueMock.mockResolvedValueOnce(null);

    await expect(
      service.publierTrajet('conducteur-1', validDto),
    ).rejects.toThrow(BadRequestException);
    expect(utilisateurFindUniqueMock).not.toHaveBeenCalled();
    expect(trajetCreateMock).not.toHaveBeenCalled();
  });

  it('publishes a trajet for a "chauffeur" conducteur (no universite de rattachement)', async () => {
    universiteFindUniqueMock.mockResolvedValueOnce({ id: 'univ-1' });
    poiFindUniqueMock.mockResolvedValueOnce({ id: 'poi-1' });
    utilisateurFindUniqueMock.mockResolvedValueOnce({
      id: 'conducteur-1',
      role: 'chauffeur',
    });
    trajetFindFirstMock.mockResolvedValueOnce(null);
    trajetCreateMock.mockResolvedValueOnce({ id: 'trajet-1' });

    const result = await service.publierTrajet('conducteur-1', validDto);

    expect(trajetCreateMock).toHaveBeenCalled();
    expect(result).toEqual({ id: 'trajet-1' });
  });

  it('throws ForbiddenException when the conducteur role is not "les deux"', async () => {
    universiteFindUniqueMock.mockResolvedValueOnce({ id: 'univ-1' });
    poiFindUniqueMock.mockResolvedValueOnce({ id: 'poi-1' });
    utilisateurFindUniqueMock.mockResolvedValueOnce({
      id: 'user-1',
      role: 'etudiant',
    });

    await expect(service.publierTrajet('user-1', validDto)).rejects.toThrow(
      ForbiddenException,
    );
    expect(trajetFindFirstMock).not.toHaveBeenCalled();
    expect(trajetCreateMock).not.toHaveBeenCalled();
  });

  it('throws ConflictException when an overlapping trajet already exists', async () => {
    universiteFindUniqueMock.mockResolvedValueOnce({ id: 'univ-1' });
    poiFindUniqueMock.mockResolvedValueOnce({ id: 'poi-1' });
    utilisateurFindUniqueMock.mockResolvedValueOnce({
      id: 'conducteur-1',
      role: 'les deux',
    });
    trajetFindFirstMock.mockResolvedValueOnce({ id: 'trajet-existing' });

    await expect(
      service.publierTrajet('conducteur-1', validDto),
    ).rejects.toThrow(ConflictException);
    expect(trajetCreateMock).not.toHaveBeenCalled();
  });

  it('throws ConflictException when the conducteur already has an active demande as createur', async () => {
    universiteFindUniqueMock.mockResolvedValueOnce({ id: 'univ-1' });
    poiFindUniqueMock.mockResolvedValueOnce({ id: 'poi-1' });
    utilisateurFindUniqueMock.mockResolvedValueOnce({
      id: 'conducteur-1',
      role: 'les deux',
    });
    trajetFindFirstMock.mockResolvedValueOnce(null);
    demandeFindFirstMock.mockResolvedValueOnce({
      id: 'demande-active',
      statut: 'ouverte',
    });

    await expect(
      service.publierTrajet('conducteur-1', validDto),
    ).rejects.toThrow(ConflictException);
    expect(trajetCreateMock).not.toHaveBeenCalled();
  });

  describe('listerTrajets', () => {
    const query = { universiteId: 'univ-1', communeId: 'commune-1' };

    it('builds the correct where/orderBy and marks the conducteur as verifie', async () => {
      trajetFindManyMock.mockResolvedValueOnce([
        {
          id: 'trajet-1',
          heure: new Date('2026-09-01T07:00:00.000Z'),
          places: 4,
          pointDeRdv: { latitude: 5.36, longitude: -3.98 },
          conducteur: {
            id: 'conducteur-1',
            nom: 'Kone',
            prenom: null,
            note: 4.5,
          },
          reservations: [],
        },
      ]);

      const result = await service.listerTrajets(query, 'user-1');

      expect(trajetFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            universiteId: 'univ-1',
            statut: 'ouvert',
            heure: { gt: expect.any(Date) as Date },
            pointDeRdv: { quartier: { communeId: 'commune-1' } },
          },
          orderBy: { heure: 'asc' },
        }),
      );
      expect(result[0].conducteur.verifie).toBe(true);
    });

    it('keeps the Prisma order (by heure) when no lat/lng is given', async () => {
      trajetFindManyMock.mockResolvedValueOnce([
        {
          id: 'trajet-early',
          heure: new Date('2026-09-01T06:00:00.000Z'),
          places: 4,
          pointDeRdv: { latitude: 5.36, longitude: -3.98 },
          conducteur: { id: 'c1', nom: null, prenom: null, note: null },
          reservations: [],
        },
        {
          id: 'trajet-late',
          heure: new Date('2026-09-01T09:00:00.000Z'),
          places: 4,
          pointDeRdv: { latitude: 5.4, longitude: -4.0 },
          conducteur: { id: 'c2', nom: null, prenom: null, note: null },
          reservations: [],
        },
      ]);

      const result = await service.listerTrajets(query, 'user-1');

      expect(result.map((t) => t.id)).toEqual(['trajet-early', 'trajet-late']);
    });

    it('sorts by distance to the given lat/lng when provided', async () => {
      trajetFindManyMock.mockResolvedValueOnce([
        {
          id: 'trajet-loin',
          heure: new Date('2026-09-01T06:00:00.000Z'),
          places: 4,
          pointDeRdv: { latitude: 5.5, longitude: -4.2 },
          conducteur: { id: 'c1', nom: null, prenom: null, note: null },
          reservations: [],
        },
        {
          id: 'trajet-proche',
          heure: new Date('2026-09-01T09:00:00.000Z'),
          places: 4,
          pointDeRdv: { latitude: 5.3601, longitude: -3.9701 },
          conducteur: { id: 'c2', nom: null, prenom: null, note: null },
          reservations: [],
        },
      ]);

      const result = await service.listerTrajets(
        { ...query, lat: 5.36, lng: -3.97 },
        'user-1',
      );

      expect(result.map((t) => t.id)).toEqual(['trajet-proche', 'trajet-loin']);
      const [proche, loin] = result as unknown as { distanceKm: number }[];
      expect(proche.distanceKm).toBeLessThan(loin.distanceKm);
    });

    it('excludes a trajet that is already complet (as many confirmed reservations as places)', async () => {
      trajetFindManyMock.mockResolvedValueOnce([
        {
          id: 'trajet-complet',
          heure: new Date('2026-09-01T07:00:00.000Z'),
          places: 2,
          pointDeRdv: { latitude: 5.36, longitude: -3.98 },
          conducteur: { id: 'c1', nom: null, prenom: null, note: null },
          reservations: [{ passagerId: 'p1' }, { passagerId: 'p2' }],
        },
        {
          id: 'trajet-ouvert',
          heure: new Date('2026-09-01T08:00:00.000Z'),
          places: 4,
          pointDeRdv: { latitude: 5.36, longitude: -3.98 },
          conducteur: { id: 'c2', nom: null, prenom: null, note: null },
          reservations: [{ passagerId: 'p1' }],
        },
      ]);

      const result = await service.listerTrajets(query, 'user-1');

      expect(result.map((t) => t.id)).toEqual(['trajet-ouvert']);
    });

    it('flags dejaReserve true when the requesting user already has a confirmed reservation', async () => {
      trajetFindManyMock.mockResolvedValueOnce([
        {
          id: 'trajet-1',
          heure: new Date('2026-09-01T07:00:00.000Z'),
          places: 4,
          pointDeRdv: { latitude: 5.36, longitude: -3.98 },
          conducteur: { id: 'c1', nom: null, prenom: null, note: null },
          reservations: [{ passagerId: 'user-1' }],
        },
      ]);

      const result = await service.listerTrajets(query, 'user-1');

      expect(result[0].dejaReserve).toBe(true);
    });
  });

  describe('getTrajetDetail', () => {
    it('throws NotFoundException when the trajet does not exist', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.getTrajetDetail('trajet-missing', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('computes placesDisponibles and exposes the cotisation unchanged', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        places: 4,
        cotisation: 875,
        conducteur: { id: 'c1', nom: null, prenom: null, note: null },
      });
      reservationCountMock.mockResolvedValueOnce(0);
      reservationFindFirstMock.mockResolvedValueOnce(null);

      const result = await service.getTrajetDetail('trajet-1', 'user-1');

      expect(result.placesDisponibles).toBe(4);
      expect(result.conducteur.verifie).toBe(true);
      expect(result.dejaReserve).toBe(false);
      // Le montant annonce ne depend plus du nombre de reservants : avant,
      // le 1er passager a ouvrir un trajet vide voyait "prixTotal / 1",
      // c'est-a-dire le prix plein de la course.
      expect(result.cotisation).toBe(875);
    });

    it('keeps the same cotisation once the trajet is nearly full', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        places: 4,
        cotisation: 875,
        conducteur: { id: 'c1', nom: null, prenom: null, note: null },
      });
      reservationCountMock.mockResolvedValueOnce(3);
      reservationFindFirstMock.mockResolvedValueOnce(null);

      const result = await service.getTrajetDetail('trajet-1', 'user-1');

      expect(result.placesDisponibles).toBe(1);
      expect(result.cotisation).toBe(875);
    });

    it('flags dejaReserve true when the requesting user already has a confirmed reservation', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        places: 4,
        cotisation: 875,
        conducteur: { id: 'c1', nom: null, prenom: null, note: null },
      });
      reservationCountMock.mockResolvedValueOnce(1);
      reservationFindFirstMock.mockResolvedValueOnce({ id: 'reservation-1' });

      const result = await service.getTrajetDetail('trajet-1', 'user-1');

      expect(reservationFindFirstMock).toHaveBeenCalledWith({
        where: { trajetId: 'trajet-1', passagerId: 'user-1', statut: 'confirmee' },
      });
      expect(result.dejaReserve).toBe(true);
    });
  });

  describe('reserverTrajet', () => {
    it('throws NotFoundException when the trajet does not exist', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.reserverTrajet('passager-1', 'trajet-missing'),
      ).rejects.toThrow(NotFoundException);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the trajet is not "ouvert"', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'annule',
        places: 4,
        cotisation: 875,
      });

      await expect(
        service.reserverTrajet('passager-1', 'trajet-1'),
      ).rejects.toThrow(ConflictException);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the conducteur tries to reserve their own trajet', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        heure: new Date(Date.now() + 3 * 60 * 60 * 1000),
        places: 4,
        cotisation: 875,
      });

      await expect(
        service.reserverTrajet('conducteur-1', 'trajet-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the passager already has an active demande as createur', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        heure: new Date(Date.now() + 3 * 60 * 60 * 1000),
        places: 4,
        cotisation: 875,
      });
      demandeFindFirstMock.mockResolvedValueOnce({
        id: 'demande-active',
        statut: 'ouverte',
      });

      await expect(
        service.reserverTrajet('passager-1', 'trajet-1'),
      ).rejects.toThrow(ConflictException);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the passager already has a confirmed reservation', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        heure: new Date(Date.now() + 3 * 60 * 60 * 1000),
        places: 4,
        cotisation: 875,
      });
      reservationFindFirstMock.mockResolvedValueOnce({
        id: 'reservation-existante',
      });

      await expect(
        service.reserverTrajet('passager-1', 'trajet-1'),
      ).rejects.toThrow(ConflictException);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the trajet is already full', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        heure: new Date(Date.now() + 3 * 60 * 60 * 1000),
        places: 2,
        cotisation: 875,
      });
      reservationFindFirstMock.mockResolvedValueOnce(null);
      reservationCountMock.mockResolvedValueOnce(2);

      await expect(
        service.reserverTrajet('passager-1', 'trajet-1'),
      ).rejects.toThrow(ConflictException);
      // Le controle "complet" se fait desormais DANS la transaction (garde-fou
      // anti-surreservation) : celle-ci est donc bien ouverte, mais elle ne
      // doit creer aucune reservation.
      expect(reservationCreateMock).not.toHaveBeenCalled();
    });

    it('creates the reservation at the announced cotisation, without touching the other reservations', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        heure: new Date(Date.now() + 3 * 60 * 60 * 1000),
        places: 4,
        cotisation: 875,
      });
      reservationFindFirstMock.mockResolvedValueOnce(null);
      reservationCountMock.mockResolvedValueOnce(3);
      reservationCreateMock.mockResolvedValueOnce({
        id: 'reservation-nouvelle',
        prixParPersonne: 875,
      });

      const result = await service.reserverTrajet('passager-4', 'trajet-1');

      expect(reservationCreateMock).toHaveBeenCalledWith({
        data: {
          trajetId: 'trajet-1',
          passagerId: 'passager-4',
          prixParPersonne: 875,
          statut: 'confirmee',
        },
      });
      // Plus aucune resynchronisation : le montant de chacun est fige a la
      // cotisation annoncee, il ne bouge plus quand d'autres rejoignent.
      expect(reservationUpdateManyMock).not.toHaveBeenCalled();
      expect(transactionMock).toHaveBeenCalled();
      expect(result).toEqual({
        id: 'reservation-nouvelle',
        prixParPersonne: 875,
      });
    });

    it('counts inside the transaction so two passengers cannot take the same last seat', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        heure: new Date(Date.now() + 3 * 60 * 60 * 1000),
        places: 4,
        cotisation: 875,
      });
      reservationFindFirstMock.mockResolvedValueOnce(null);
      reservationCountMock.mockResolvedValueOnce(1);
      reservationCreateMock.mockResolvedValueOnce({ id: 'reservation-1' });

      await service.reserverTrajet('passager-1', 'trajet-1');

      expect(transactionMock).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: 'Serializable',
      });
    });
  });

  describe('listerMesTrajets', () => {
    it('lists all trajets for the given conducteur, whatever their statut, with placesDisponibles and passagers', async () => {
      trajetFindManyMock.mockResolvedValueOnce([
        { id: 'trajet-1', places: 4, statut: 'ouvert' },
        { id: 'trajet-2', places: 2, statut: 'commence' },
      ]);
      reservationFindManyMock.mockResolvedValueOnce([
        {
          passager: { id: 'passager-1', nom: 'Kone', prenom: 'Awa' },
        },
      ]); // trajet-1
      reservationFindManyMock.mockResolvedValueOnce([
        { passager: { id: 'passager-2', nom: 'Diallo', prenom: 'Issa' } },
        { passager: { id: 'passager-3', nom: 'Traore', prenom: 'Fatou' } },
      ]); // trajet-2

      const result = await service.listerMesTrajets('conducteur-1');

      expect(trajetFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { conducteurId: 'conducteur-1' },
          orderBy: { heure: 'asc' },
        }),
      );
      expect(result).toEqual([
        expect.objectContaining({
          id: 'trajet-1',
          placesDisponibles: 3,
          passagers: [{ id: 'passager-1', nom: 'Kone', prenom: 'Awa' }],
        }),
        expect.objectContaining({
          id: 'trajet-2',
          placesDisponibles: 0,
          passagers: [
            { id: 'passager-2', nom: 'Diallo', prenom: 'Issa' },
            { id: 'passager-3', nom: 'Traore', prenom: 'Fatou' },
          ],
        }),
      ]);
    });
  });

  describe('demarrerTrajet', () => {
    it('throws NotFoundException when the trajet does not exist', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.demarrerTrajet('conducteur-1', 'trajet-missing'),
      ).rejects.toThrow(NotFoundException);
      expect(trajetUpdateMock).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the trajet belongs to someone else', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'autre-conducteur',
        statut: 'ouvert',
      });

      await expect(
        service.demarrerTrajet('conducteur-1', 'trajet-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(trajetUpdateMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the trajet is not "ouvert"', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'commence',
      });

      await expect(
        service.demarrerTrajet('conducteur-1', 'trajet-1'),
      ).rejects.toThrow(ConflictException);
      expect(trajetUpdateMock).not.toHaveBeenCalled();
    });

    it('sets the statut to "commence" when the checks pass', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
      });
      trajetUpdateMock.mockResolvedValueOnce({
        id: 'trajet-1',
        statut: 'commence',
      });

      const result = await service.demarrerTrajet('conducteur-1', 'trajet-1');

      expect(trajetUpdateMock).toHaveBeenCalledWith({
        where: { id: 'trajet-1' },
        data: { statut: 'commence' },
      });
      expect(result).toEqual({ id: 'trajet-1', statut: 'commence' });
    });
  });

  describe('terminerTrajet', () => {
    it('throws ConflictException when the trajet is not "commence"', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
      });

      await expect(
        service.terminerTrajet('conducteur-1', 'trajet-1'),
      ).rejects.toThrow(ConflictException);
      expect(trajetUpdateMock).not.toHaveBeenCalled();
    });

    it('sets the statut to "termine" when the checks pass', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'commence',
      });
      trajetUpdateMock.mockResolvedValueOnce({
        id: 'trajet-1',
        statut: 'termine',
      });

      const result = await service.terminerTrajet('conducteur-1', 'trajet-1');

      expect(trajetUpdateMock).toHaveBeenCalledWith({
        where: { id: 'trajet-1' },
        data: { statut: 'termine' },
      });
      expect(result).toEqual({ id: 'trajet-1', statut: 'termine' });
    });

    it('deletes the chat via MessagerieService once the trajet is terminated', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'commence',
      });
      trajetUpdateMock.mockResolvedValueOnce({
        id: 'trajet-1',
        statut: 'termine',
      });

      await service.terminerTrajet('conducteur-1', 'trajet-1');

      expect(supprimerChatTrajetMock).toHaveBeenCalledWith('trajet-1');
    });
  });

  describe('annulerTrajet', () => {
    const heureLointaine = new Date(Date.now() + 5 * 60 * 60 * 1000); // +5h
    const heureProche = new Date(Date.now() + 30 * 60 * 1000); // +30min

    it('throws NotFoundException when the trajet does not exist', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.annulerTrajet('conducteur-1', 'trajet-missing'),
      ).rejects.toThrow(NotFoundException);
      expect(trajetUpdateMock).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the trajet belongs to someone else', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'autre-conducteur',
        statut: 'ouvert',
        heure: heureLointaine,
      });

      await expect(
        service.annulerTrajet('conducteur-1', 'trajet-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(trajetUpdateMock).not.toHaveBeenCalled();
    });

    it.each(['commence', 'termine', 'annule'])(
      'throws ConflictException when the trajet statut is "%s"',
      async (statut) => {
        trajetFindUniqueMock.mockResolvedValueOnce({
          id: 'trajet-1',
          conducteurId: 'conducteur-1',
          statut,
          heure: heureLointaine,
        });

        await expect(
          service.annulerTrajet('conducteur-1', 'trajet-1'),
        ).rejects.toThrow(ConflictException);
        expect(trajetUpdateMock).not.toHaveBeenCalled();
      },
    );

    it('cancels the trajet without touching the note when far from departure', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        heure: heureLointaine,
      });
      trajetUpdateMock.mockResolvedValueOnce({
        id: 'trajet-1',
        statut: 'annule',
      });
      reservationFindManyMock.mockResolvedValueOnce([]);

      const result = await service.annulerTrajet('conducteur-1', 'trajet-1');

      expect(trajetUpdateMock).toHaveBeenCalledWith({
        where: { id: 'trajet-1' },
        data: { statut: 'annule' },
      });
      expect(utilisateurFindUniqueMock).not.toHaveBeenCalled();
      expect(utilisateurUpdateMock).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'trajet-1', statut: 'annule' });
    });

    it("ne sanctionne PAS une annulation tardive quand personne n'a reserve", async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        heure: heureProche,
      });
      trajetUpdateMock.mockResolvedValueOnce({
        id: 'trajet-1',
        statut: 'annule',
      });
      reservationFindManyMock.mockResolvedValueOnce([]);

      await service.annulerTrajet('conducteur-1', 'trajet-1');

      // Retirer une annonce que personne n'a reservee ne lese personne :
      // sanctionner ce cas reviendrait a punir le fait d'avoir propose un
      // trajet. Meme principe que l'annulation d'une demande sans
      // participant, qui n'a jamais ete sanctionnee.
      expect(utilisateurFindUniqueMock).not.toHaveBeenCalled();
      expect(utilisateurUpdateMock).not.toHaveBeenCalled();
    });

    it('decrements the note when cancelling less than 2h before departure', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        heure: heureProche,
      });
      trajetUpdateMock.mockResolvedValueOnce({
        id: 'trajet-1',
        statut: 'annule',
      });
      utilisateurFindUniqueMock.mockResolvedValueOnce({
        id: 'conducteur-1',
        noteBrute: 4.0,
        penaliteCumulee: 0,
      });
      // Un passager est lese : c'est ce qui declenche la sanction.
      reservationFindManyMock.mockResolvedValueOnce([
        { passagerId: 'passager-1' },
      ]);

      await service.annulerTrajet('conducteur-1', 'trajet-1');

      expect(utilisateurUpdateMock).toHaveBeenCalledWith({
        where: { id: 'conducteur-1' },
        data: { penaliteCumulee: 0.5, note: 3.5 },
      });
    });

    it('floors the note at 1.0 instead of going lower', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        heure: heureProche,
      });
      trajetUpdateMock.mockResolvedValueOnce({
        id: 'trajet-1',
        statut: 'annule',
      });
      utilisateurFindUniqueMock.mockResolvedValueOnce({
        id: 'conducteur-1',
        noteBrute: 1.2,
        penaliteCumulee: 0,
      });
      // Un passager est lese : c'est ce qui declenche la sanction.
      reservationFindManyMock.mockResolvedValueOnce([
        { passagerId: 'passager-1' },
      ]);

      await service.annulerTrajet('conducteur-1', 'trajet-1');

      expect(utilisateurUpdateMock).toHaveBeenCalledWith({
        where: { id: 'conducteur-1' },
        data: { penaliteCumulee: 0.5, note: 1 },
      });
    });

    it('accumulates the penalty (kept for the next notation recalc) even when the conducteur has never been rated (noteBrute is null)', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        heure: heureProche,
      });
      trajetUpdateMock.mockResolvedValueOnce({
        id: 'trajet-1',
        statut: 'annule',
      });
      utilisateurFindUniqueMock.mockResolvedValueOnce({
        id: 'conducteur-1',
        noteBrute: null,
        penaliteCumulee: 0,
      });
      // Un passager est lese : c'est ce qui declenche la sanction.
      reservationFindManyMock.mockResolvedValueOnce([
        { passagerId: 'passager-1' },
      ]);

      await service.annulerTrajet('conducteur-1', 'trajet-1');

      expect(utilisateurUpdateMock).toHaveBeenCalledWith({
        where: { id: 'conducteur-1' },
        data: { penaliteCumulee: 0.5, note: null },
      });
    });

    it('logs one notification per confirmed passager', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        heure: heureLointaine,
      });
      trajetUpdateMock.mockResolvedValueOnce({
        id: 'trajet-1',
        statut: 'annule',
      });
      reservationFindManyMock.mockResolvedValueOnce([
        { passagerId: 'passager-1' },
        { passagerId: 'passager-2' },
      ]);
      await service.annulerTrajet('conducteur-1', 'trajet-1');

      expect(reservationFindManyMock).toHaveBeenCalledWith({
        where: { trajetId: 'trajet-1', statut: 'confirmee' },
        select: { passagerId: true },
      });
      expect(notificationsMock.envoyer).toHaveBeenCalledWith(
        ['passager-1', 'passager-2'],
        'Trajet annulé',
        expect.any(String) as unknown as string,
        { type: 'trajet', id: 'trajet-1' },
      );
    });
  });

  describe('annulerReservation', () => {
    const heureLointaine = new Date(Date.now() + 5 * 60 * 60 * 1000); // +5h
    const heureProche = new Date(Date.now() + 30 * 60 * 1000); // +30min

    it.each([
      ['no reservation at all', null],
      ['already cancelled reservation', null],
    ])(
      'throws NotFoundException when there is no confirmed reservation (%s)',
      async (_label, resolved) => {
        reservationFindFirstMock.mockResolvedValueOnce(resolved);

        await expect(
          service.annulerReservation('passager-1', 'trajet-1'),
        ).rejects.toThrow(NotFoundException);
        expect(reservationUpdateMock).not.toHaveBeenCalled();
      },
    );

    describe('when less than 2h remain before departure (annulation tardive)', () => {
      beforeEach(() => {
        reservationFindFirstMock.mockResolvedValueOnce({
          id: 'reservation-1',
          trajetId: 'trajet-1',
          passagerId: 'passager-1',
          trajet: { id: 'trajet-1', conducteurId: 'conducteur-1', heure: heureProche, cotisation: 875 },
        });
      });

      it('cancels the whole trajet for everyone and marks the reservation annulee', async () => {
        utilisateurFindUniqueOrThrowMock.mockResolvedValueOnce({
          annulationsTardives: 0,
        });
        reservationUpdateMock.mockResolvedValueOnce({
          id: 'reservation-1',
          statut: 'annulee',
        });

        const result = await service.annulerReservation('passager-1', 'trajet-1');

        expect(trajetUpdateMock).toHaveBeenCalledWith({
          where: { id: 'trajet-1' },
          data: { statut: 'annule' },
        });
        // La ligne Reservation doit reellement passer a "annulee" en base --
        // avant, seul un objet fabrique etait retourne (cf. bug identifie).
        expect(reservationUpdateMock).toHaveBeenCalledWith({
          where: { id: 'reservation-1' },
          data: { statut: 'annulee' },
        });
        expect(result).toEqual({
          id: 'reservation-1',
          statut: 'annulee',
          trajetAnnule: true,
          suspenduJusqua: null,
        });
      });

      it('returns suspenduJusqua so the app can explain before logging the user out', async () => {
        utilisateurFindUniqueOrThrowMock.mockResolvedValueOnce({
          annulationsTardives: 1,
        });
        reservationUpdateMock.mockResolvedValueOnce({
          id: 'reservation-1',
          statut: 'annulee',
        });

        const result = (await service.annulerReservation(
          'passager-1',
          'trajet-1',
        )) as { suspenduJusqua: Date | null };

        expect(result.suspenduJusqua).toBeInstanceOf(Date);
      });

      it('does not suspend the passenger on their first late cancellation', async () => {
        utilisateurFindUniqueOrThrowMock.mockResolvedValueOnce({
          annulationsTardives: 0,
        });

        await service.annulerReservation('passager-1', 'trajet-1');

        expect(utilisateurUpdateMock).toHaveBeenCalledWith({
          where: { id: 'passager-1' },
          data: { annulationsTardives: 1 },
        });
      });

      it('suspends the passenger and resets the counter on their second late cancellation', async () => {
        utilisateurFindUniqueOrThrowMock.mockResolvedValueOnce({
          annulationsTardives: 1,
        });

        await service.annulerReservation('passager-1', 'trajet-1');

        expect(utilisateurUpdateMock).toHaveBeenCalledTimes(1);
        const [{ data }] = utilisateurUpdateMock.mock.calls[0] as [
          { data: { annulationsTardives: number; suspenduJusqua: Date } },
        ];
        // Remis a 0 (pas incremente a 2) -- un nouveau cycle "2 essais"
        // recommence apres chaque suspension, plutot qu'un compteur a vie.
        expect(data.annulationsTardives).toBe(0);
        const joursRestants =
          (data.suspenduJusqua.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
        expect(joursRestants).toBeGreaterThan(20.9);
        expect(joursRestants).toBeLessThan(21.1);
      });

      it('notifies the other confirmed passengers', async () => {
        utilisateurFindUniqueOrThrowMock.mockResolvedValueOnce({
          annulationsTardives: 0,
        });
        reservationFindManyMock.mockResolvedValueOnce([
          { passagerId: 'passager-2' },
          { passagerId: 'passager-3' },
        ]);
        await service.annulerReservation('passager-1', 'trajet-1');

        expect(reservationFindManyMock).toHaveBeenCalledWith({
          where: {
            trajetId: 'trajet-1',
            statut: 'confirmee',
            passagerId: { not: 'passager-1' },
          },
          select: { passagerId: true },
        });
        // Les autres passagers ET le conducteur perdent le trajet.
        expect(notificationsMock.envoyer).toHaveBeenCalledWith(
          ['passager-2', 'passager-3', 'conducteur-1'],
          'Trajet annulé',
          expect.any(String) as unknown as string,
          { type: 'trajet', id: 'trajet-1' },
        );
      });
    });

    it('cancels the reservation without recalculating price when no one else remains', async () => {
      reservationFindFirstMock.mockResolvedValueOnce({
        id: 'reservation-1',
        trajetId: 'trajet-1',
        passagerId: 'passager-1',
        trajet: { id: 'trajet-1', conducteurId: 'conducteur-1', heure: heureLointaine, cotisation: 875 },
      });
      reservationCountMock.mockResolvedValueOnce(0);
      reservationUpdateMock.mockResolvedValueOnce({
        id: 'reservation-1',
        statut: 'annulee',
      });

      const result = await service.annulerReservation('passager-1', 'trajet-1');

      expect(reservationUpdateMock).toHaveBeenCalledWith({
        where: { id: 'reservation-1' },
        data: { statut: 'annulee' },
      });
      expect(reservationUpdateManyMock).not.toHaveBeenCalled();
      // trajetAnnule false : seule la place se libere, le trajet continue.
      expect(result).toEqual({
        id: 'reservation-1',
        statut: 'annulee',
        trajetAnnule: false,
        suspenduJusqua: null,
      });
    });

    it('leaves the remaining passagers at the price they accepted', async () => {
      reservationFindFirstMock.mockResolvedValueOnce({
        id: 'reservation-1',
        trajetId: 'trajet-1',
        passagerId: 'passager-1',
        trajet: { id: 'trajet-1', conducteurId: 'conducteur-1', heure: heureLointaine, cotisation: 875 },
      });
      reservationUpdateMock.mockResolvedValueOnce({
        id: 'reservation-1',
        statut: 'annulee',
      });

      await service.annulerReservation('passager-1', 'trajet-1');

      // Avant, le depart d'un passager faisait grimper la note des autres
      // (prixTotal redivise) : ils payaient plus que le montant accepte.
      expect(reservationUpdateManyMock).not.toHaveBeenCalled();
    });

    it('logs one notification', async () => {
      reservationFindFirstMock.mockResolvedValueOnce({
        id: 'reservation-1',
        trajetId: 'trajet-1',
        passagerId: 'passager-1',
        trajet: { id: 'trajet-1', conducteurId: 'conducteur-1', heure: heureLointaine, cotisation: 875 },
      });
      reservationCountMock.mockResolvedValueOnce(0);
      reservationUpdateMock.mockResolvedValueOnce({
        id: 'reservation-1',
        statut: 'annulee',
      });
      await service.annulerReservation('passager-1', 'trajet-1');

      // Le conducteur est prevenu qu'une place s'est liberee.
      expect(notificationsMock.envoyer).toHaveBeenCalledWith(
        ['conducteur-1'],
        'Un passager a annulé',
        expect.any(String) as unknown as string,
        { type: 'trajet', id: 'trajet-1' },
      );
    });
  });

  describe('signalerNoShow', () => {
    const heurePassee = new Date(Date.now() - 5 * 60 * 1000); // -5min
    const heureFuture = new Date(Date.now() + 5 * 60 * 1000); // +5min

    it('throws NotFoundException when the trajet does not exist', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.signalerNoShow('passager-1', 'trajet-missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it.each(['commence', 'termine', 'annule'])(
      'throws ConflictException when the trajet statut is "%s"',
      async (statut) => {
        trajetFindUniqueMock.mockResolvedValueOnce({
          id: 'trajet-1',
          conducteurId: 'conducteur-1',
          statut,
          heure: heurePassee,
        });

        await expect(
          service.signalerNoShow('passager-1', 'trajet-1'),
        ).rejects.toThrow(ConflictException);
      },
    );

    it('throws ConflictException when the departure time has not passed yet', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        heure: heureFuture,
      });

      await expect(
        service.signalerNoShow('passager-1', 'trajet-1'),
      ).rejects.toThrow(ConflictException);
      expect(trajetUpdateMock).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the caller has no confirmed reservation', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        heure: heurePassee,
      });
      reservationFindFirstMock.mockResolvedValueOnce(null);

      await expect(
        service.signalerNoShow('passager-1', 'trajet-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(trajetUpdateMock).not.toHaveBeenCalled();
    });

    it('cancels the trajet and decrements the note by NO_SHOW_PENALTY', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        heure: heurePassee,
      });
      reservationFindFirstMock.mockResolvedValueOnce({
        id: 'reservation-1',
        trajetId: 'trajet-1',
        passagerId: 'passager-1',
        statut: 'confirmee',
      });
      utilisateurFindUniqueMock.mockResolvedValueOnce({
        id: 'conducteur-1',
        noteBrute: 4.0,
        penaliteCumulee: 0,
      });
      trajetUpdateMock.mockResolvedValueOnce({
        id: 'trajet-1',
        statut: 'annule',
      });
      reservationFindManyMock.mockResolvedValueOnce([]);

      const result = await service.signalerNoShow('passager-1', 'trajet-1');

      expect(trajetUpdateMock).toHaveBeenCalledWith({
        where: { id: 'trajet-1' },
        data: { statut: 'annule' },
      });
      expect(utilisateurUpdateMock).toHaveBeenCalledWith({
        where: { id: 'conducteur-1' },
        data: { penaliteCumulee: 1, note: 3 },
      });
      expect(result).toEqual({ id: 'trajet-1', statut: 'annule' });
    });

    it('floors the note at MIN_NOTE instead of going lower', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        heure: heurePassee,
      });
      reservationFindFirstMock.mockResolvedValueOnce({
        id: 'reservation-1',
        trajetId: 'trajet-1',
        passagerId: 'passager-1',
        statut: 'confirmee',
      });
      utilisateurFindUniqueMock.mockResolvedValueOnce({
        id: 'conducteur-1',
        noteBrute: 1.5,
        penaliteCumulee: 0,
      });
      trajetUpdateMock.mockResolvedValueOnce({
        id: 'trajet-1',
        statut: 'annule',
      });
      reservationFindManyMock.mockResolvedValueOnce([]);

      await service.signalerNoShow('passager-1', 'trajet-1');

      expect(utilisateurUpdateMock).toHaveBeenCalledWith({
        where: { id: 'conducteur-1' },
        data: { penaliteCumulee: 1, note: 1 },
      });
    });

    it('accumulates the penalty even when the conducteur has never been rated', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        heure: heurePassee,
      });
      reservationFindFirstMock.mockResolvedValueOnce({
        id: 'reservation-1',
        trajetId: 'trajet-1',
        passagerId: 'passager-1',
        statut: 'confirmee',
      });
      utilisateurFindUniqueMock.mockResolvedValueOnce({
        id: 'conducteur-1',
        noteBrute: null,
        penaliteCumulee: 0,
      });
      trajetUpdateMock.mockResolvedValueOnce({
        id: 'trajet-1',
        statut: 'annule',
      });
      reservationFindManyMock.mockResolvedValueOnce([]);

      await service.signalerNoShow('passager-1', 'trajet-1');

      expect(utilisateurUpdateMock).toHaveBeenCalledWith({
        where: { id: 'conducteur-1' },
        data: { penaliteCumulee: 1, note: null },
      });
    });

    it('logs one notification per confirmed passager', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        heure: heurePassee,
      });
      reservationFindFirstMock.mockResolvedValueOnce({
        id: 'reservation-1',
        trajetId: 'trajet-1',
        passagerId: 'passager-1',
        statut: 'confirmee',
      });
      utilisateurFindUniqueMock.mockResolvedValueOnce({
        id: 'conducteur-1',
        noteBrute: null,
        penaliteCumulee: 0,
      });
      trajetUpdateMock.mockResolvedValueOnce({
        id: 'trajet-1',
        statut: 'annule',
      });
      reservationFindManyMock.mockResolvedValueOnce([
        { passagerId: 'passager-1' },
        { passagerId: 'passager-2' },
      ]);
      await service.signalerNoShow('passager-1', 'trajet-1');

      expect(notificationsMock.envoyer).toHaveBeenCalledWith(
        ['passager-1', 'passager-2'],
        'Trajet annulé',
        expect.any(String) as unknown as string,
        { type: 'trajet', id: 'trajet-1' },
      );
    });

    it('creates a Signalement for the conducteur (Story 7.1)', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        heure: heurePassee,
      });
      reservationFindFirstMock.mockResolvedValueOnce({
        id: 'reservation-1',
        trajetId: 'trajet-1',
        passagerId: 'passager-1',
        statut: 'confirmee',
      });
      utilisateurFindUniqueMock.mockResolvedValueOnce({
        id: 'conducteur-1',
        noteBrute: null,
        penaliteCumulee: 0,
      });
      trajetUpdateMock.mockResolvedValueOnce({
        id: 'trajet-1',
        statut: 'annule',
      });

      await service.signalerNoShow('passager-1', 'trajet-1');

      expect(signalementCreateMock).toHaveBeenCalledWith({
        data: {
          trajetId: 'trajet-1',
          type: 'no_show_conducteur',
          signaleParId: 'passager-1',
          concerneId: 'conducteur-1',
        },
      });
    });
  });

  describe('envoyerRappelsDepart', () => {
    it('sends the 2h reminder to the conducteur and confirmed passagers, then marks it sent', async () => {
      trajetFindManyMock
        .mockResolvedValueOnce([
          {
            id: 'trajet-1',
            conducteurId: 'conducteur-1',
            reservations: [{ passagerId: 'passager-1' }],
          },
        ])
        .mockResolvedValueOnce([]);

      await service.envoyerRappelsDepart();

      expect(trajetFindManyMock).toHaveBeenNthCalledWith(1, {
        where: {
          statut: 'ouvert',
          rappel2hEnvoye: false,
          heure: expect.objectContaining({}) as unknown,
        },
        include: {
          reservations: {
            where: { statut: 'confirmee' },
            select: { passagerId: true },
          },
        },
      });
      expect(trajetUpdateMock).toHaveBeenCalledWith({
        where: { id: 'trajet-1' },
        data: { rappel2hEnvoye: true },
      });
      // Conducteur + passagers, en un seul envoi groupe.
      expect(notificationsMock.envoyer).toHaveBeenCalledWith(
        ['conducteur-1', 'passager-1'],
        'Départ bientôt',
        expect.stringContaining('1h15') as unknown as string,
        { type: 'trajet', id: 'trajet-1' },
      );
    });

    it('sends the 1h reminder separately and marks only that flag', async () => {
      trajetFindManyMock.mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          id: 'trajet-2',
          conducteurId: 'conducteur-1',
          reservations: [],
        },
      ]);

      await service.envoyerRappelsDepart();

      expect(trajetFindManyMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({ rappel1hEnvoye: false }) as object,
        }),
      );
      expect(trajetUpdateMock).toHaveBeenCalledWith({
        where: { id: 'trajet-2' },
        data: { rappel1hEnvoye: true },
      });
    });

    it('does not send anything when no trajet is eligible for either threshold', async () => {
      trajetFindManyMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await service.envoyerRappelsDepart();

      expect(trajetUpdateMock).not.toHaveBeenCalled();
    });
  });

  describe('expirerTrajetsSansPassager', () => {
    it('cancels an "ouvert" trajet with no confirmed reservation once its heure has passed', async () => {
      trajetFindManyMock.mockResolvedValueOnce([
        { id: 'trajet-1', conducteurId: 'conducteur-1' },
      ]);
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.expirerTrajetsSansPassager();
      // Aucun passager a prevenir par definition : seul le journal serveur
      // trace la cloture automatique.

      expect(trajetFindManyMock).toHaveBeenCalledWith({
        where: {
          statut: 'ouvert',
          heure: { lte: expect.any(Date) as Date },
          reservations: { none: { statut: 'confirmee' } },
        },
      });
      expect(trajetUpdateMock).toHaveBeenCalledWith({
        where: { id: 'trajet-1' },
        data: { statut: 'annule' },
      });
      expect(loggerSpy).toHaveBeenCalledTimes(1);
    });

    it('previent le conducteur que son annonce sans reservation est retiree', async () => {
      trajetFindManyMock.mockResolvedValueOnce([
        { id: 'trajet-1', conducteurId: 'conducteur-1' },
      ]);

      await service.expirerTrajetsSansPassager();

      expect(notificationsMock.envoyer).toHaveBeenCalledWith(
        ['conducteur-1'],
        'Trajet retiré',
        expect.any(String) as unknown as string,
        { type: 'trajet', id: 'trajet-1' },
      );
    });

    it('does nothing when no trajet is eligible', async () => {
      trajetFindManyMock.mockResolvedValueOnce([]);

      await service.expirerTrajetsSansPassager();

      expect(trajetUpdateMock).not.toHaveBeenCalled();
    });
  });

  describe('cloturerTrajetsEnRetard', () => {
    it('targets both "ouvert" and "commence" trajets well past their heure', async () => {
      trajetFindManyMock.mockResolvedValueOnce([]);

      await service.cloturerTrajetsEnRetard();

      expect(trajetFindManyMock).toHaveBeenCalledWith({
        where: {
          statut: { in: ['ouvert', 'commence'] },
          heure: { lte: expect.any(Date) as Date },
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
    });

    it('terminates a "commence" trajet and deletes its chat (the ride did happen)', async () => {
      trajetFindManyMock.mockResolvedValueOnce([
        {
          id: 'trajet-1',
          statut: 'commence',
          conducteurId: 'conducteur-1',
          reservations: [{ passagerId: 'passager-1' }],
        },
      ]);

      await service.cloturerTrajetsEnRetard();

      expect(trajetUpdateMock).toHaveBeenCalledWith({
        where: { id: 'trajet-1' },
        data: { statut: 'termine' },
      });
      expect(supprimerChatTrajetMock).toHaveBeenCalledWith('trajet-1');
    });

    it('cancels an "ouvert" trajet instead (departure never confirmed, nothing proves it happened)', async () => {
      trajetFindManyMock.mockResolvedValueOnce([
        {
          id: 'trajet-2',
          statut: 'ouvert',
          conducteurId: 'conducteur-1',
          reservations: [],
        },
      ]);

      await service.cloturerTrajetsEnRetard();

      expect(trajetUpdateMock).toHaveBeenCalledWith({
        where: { id: 'trajet-2' },
        data: { statut: 'annule' },
      });
      expect(supprimerChatTrajetMock).not.toHaveBeenCalled();
    });

    it('previent le conducteur ET les passagers de la cloture automatique', async () => {
      trajetFindManyMock.mockResolvedValueOnce([
        {
          id: 'trajet-1',
          statut: 'commence',
          conducteurId: 'conducteur-1',
          reservations: [{ passagerId: 'passager-1' }],
        },
      ]);

      await service.cloturerTrajetsEnRetard();

      expect(notificationsMock.envoyer).toHaveBeenCalledWith(
        ['conducteur-1', 'passager-1'],
        'Trajet terminé',
        expect.any(String) as unknown as string,
        { type: 'trajet', id: 'trajet-1' },
      );
    });

    it('does nothing when no trajet is stuck', async () => {
      trajetFindManyMock.mockResolvedValueOnce([]);

      await service.cloturerTrajetsEnRetard();

      expect(trajetUpdateMock).not.toHaveBeenCalled();
    });
  });

  describe('demande Mode A liee a un trajet annule', () => {
    const heureProche = new Date(Date.now() + 30 * 60 * 1000);
    const heureLointaine = new Date(Date.now() + 5 * 60 * 60 * 1000);

    it('reopens the demande to "quota_atteint" when the conducteur cancels (§8.3)', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        heure: heureLointaine,
      });
      trajetUpdateMock.mockResolvedValueOnce({ id: 'trajet-1', statut: 'annule' });
      demandeFindUniqueMock.mockResolvedValueOnce({
        id: 'demande-1',
        statut: 'acceptee',
      });

      await service.annulerTrajet('conducteur-1', 'trajet-1');

      expect(demandeUpdateMock).toHaveBeenCalledWith({
        where: { id: 'demande-1' },
        data: { statut: 'quota_atteint', trajetId: null },
      });
    });

    it('closes the demande instead when a passager cancels late (the group itself is broken)', async () => {
      reservationFindFirstMock.mockResolvedValueOnce({
        id: 'reservation-1',
        trajetId: 'trajet-1',
        passagerId: 'passager-1',
        trajet: { id: 'trajet-1', conducteurId: 'conducteur-1', heure: heureProche, cotisation: 875 },
      });
      utilisateurFindUniqueOrThrowMock.mockResolvedValueOnce({
        annulationsTardives: 0,
      });
      demandeFindUniqueMock.mockResolvedValueOnce({
        id: 'demande-1',
        statut: 'acceptee',
      });

      await service.annulerReservation('passager-1', 'trajet-1');

      expect(demandeUpdateMock).toHaveBeenCalledWith({
        where: { id: 'demande-1' },
        data: { statut: 'annulee' },
      });
    });

    it('leaves a Mode B trajet alone (no linked demande)', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        heure: heureLointaine,
      });
      trajetUpdateMock.mockResolvedValueOnce({ id: 'trajet-1', statut: 'annule' });
      demandeFindUniqueMock.mockResolvedValueOnce(null);

      await service.annulerTrajet('conducteur-1', 'trajet-1');

      expect(demandeUpdateMock).not.toHaveBeenCalled();
    });
  });

  describe('listerMesReservations', () => {
    it('marks peutVoirRencontre true only for "ouvert" trajets', async () => {
      trajetFindManyMock.mockResolvedValueOnce([
        { id: 'trajet-1', statut: 'ouvert' },
        { id: 'trajet-2', statut: 'commence' },
      ]);

      const result = await service.listerMesReservations('passager-1');

      expect(trajetFindManyMock).toHaveBeenCalledWith({
        where: {
          reservations: {
            some: { passagerId: 'passager-1', statut: 'confirmee' },
          },
        },
        include: expect.anything() as unknown,
        orderBy: { heure: 'asc' },
      });
      expect(result[0].peutVoirRencontre).toBe(true);
      expect(result[1].peutVoirRencontre).toBe(false);
    });
  });

  describe('getRencontre', () => {
    it('throws NotFoundException when the trajet does not exist', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.getRencontre('passager-1', 'trajet-missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the caller has no confirmed reservation', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
      });
      reservationFindFirstMock.mockResolvedValueOnce(null);

      await expect(
        service.getRencontre('passager-1', 'trajet-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when the trajet is no longer "ouvert"', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'commence',
      });
      reservationFindFirstMock.mockResolvedValueOnce({ id: 'reservation-1' });

      await expect(
        service.getRencontre('passager-1', 'trajet-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('returns the conducteur rencontre details when eligible', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
      });
      reservationFindFirstMock.mockResolvedValueOnce({ id: 'reservation-1' });
      utilisateurFindUniqueOrThrowMock.mockResolvedValueOnce({
        id: 'conducteur-1',
        nom: 'Kone',
        prenom: 'Awa',
        note: 4.5,
        nombreNotations: 12,
      });
      documentsConducteurFindFirstMock.mockResolvedValueOnce({
        matriculeVehicule: 'CI-2847-AB',
        photoVehicule: 'vehicule.jpg',
        motBienvenue: 'Bienvenue a bord !',
      });

      const result = await service.getRencontre('passager-1', 'trajet-1');

      expect(result).toEqual({
        conducteur: {
          nom: 'Kone',
          prenom: 'Awa',
          note: 4.5,
          nombreNotations: 12,
          verifie: true,
          matriculeVehicule: 'CI-2847-AB',
          photoVehicule: 'vehicule.jpg',
          motBienvenue: 'Bienvenue a bord !',
        },
      });
    });

    it('returns null document fields when no valid DocumentsConducteur is found', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
      });
      reservationFindFirstMock.mockResolvedValueOnce({ id: 'reservation-1' });
      utilisateurFindUniqueOrThrowMock.mockResolvedValueOnce({
        id: 'conducteur-1',
        nom: 'Kone',
        prenom: 'Awa',
        note: null,
      });
      documentsConducteurFindFirstMock.mockResolvedValueOnce(null);

      const result = await service.getRencontre('passager-1', 'trajet-1');

      expect(result.conducteur.matriculeVehicule).toBeNull();
      expect(result.conducteur.photoVehicule).toBeNull();
      expect(result.conducteur.motBienvenue).toBeNull();
    });
  });

  describe('getRencontrePhotoVehiculePath', () => {
    it('throws NotFoundException when the trajet does not exist', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.getRencontrePhotoVehiculePath('passager-1', 'trajet-missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the caller has no confirmed reservation', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
      });
      reservationFindFirstMock.mockResolvedValueOnce(null);

      await expect(
        service.getRencontrePhotoVehiculePath('passager-1', 'trajet-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when the trajet is no longer "ouvert"', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'commence',
      });
      reservationFindFirstMock.mockResolvedValueOnce({ id: 'reservation-1' });

      await expect(
        service.getRencontrePhotoVehiculePath('passager-1', 'trajet-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when no valid DocumentsConducteur is found', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
      });
      reservationFindFirstMock.mockResolvedValueOnce({ id: 'reservation-1' });
      documentsConducteurFindFirstMock.mockResolvedValueOnce(null);

      await expect(
        service.getRencontrePhotoVehiculePath('passager-1', 'trajet-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when photoVehicule is null', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
      });
      reservationFindFirstMock.mockResolvedValueOnce({ id: 'reservation-1' });
      documentsConducteurFindFirstMock.mockResolvedValueOnce({
        matriculeVehicule: 'CI-2847-AB',
        photoVehicule: null,
        motBienvenue: 'Bienvenue a bord !',
      });

      await expect(
        service.getRencontrePhotoVehiculePath('passager-1', 'trajet-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns the absolute path to the photo when eligible', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
      });
      reservationFindFirstMock.mockResolvedValueOnce({ id: 'reservation-1' });
      documentsConducteurFindFirstMock.mockResolvedValueOnce({
        matriculeVehicule: 'CI-2847-AB',
        photoVehicule: 'vehicule.jpg',
        motBienvenue: 'Bienvenue a bord !',
      });

      const result = await service.getRencontrePhotoVehiculePath(
        'passager-1',
        'trajet-1',
      );

      expect(result).toBe(join(CONDUCTEUR_UPLOADS_DIR, 'vehicule.jpg'));
    });
  });

  describe('signalerPassagerAbsent', () => {
    it('throws NotFoundException when the trajet does not exist', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.signalerPassagerAbsent(
          'conducteur-1',
          'trajet-missing',
          'passager-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the trajet belongs to someone else', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'autre-conducteur',
        statut: 'termine',
      });

      await expect(
        service.signalerPassagerAbsent(
          'conducteur-1',
          'trajet-1',
          'passager-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it.each(['ouvert', 'commence', 'annule'])(
      'throws ConflictException when the trajet statut is "%s"',
      async (statut) => {
        trajetFindUniqueMock.mockResolvedValueOnce({
          id: 'trajet-1',
          conducteurId: 'conducteur-1',
          statut,
        });

        await expect(
          service.signalerPassagerAbsent(
            'conducteur-1',
            'trajet-1',
            'passager-1',
          ),
        ).rejects.toThrow(ConflictException);
      },
    );

    it('throws BadRequestException when the passager was never enrolled', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'termine',
      });
      reservationFindFirstMock.mockResolvedValueOnce(null);

      await expect(
        service.signalerPassagerAbsent(
          'conducteur-1',
          'trajet-1',
          'passager-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when the passager was already signaled absent', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'termine',
      });
      reservationFindFirstMock.mockResolvedValueOnce({
        id: 'reservation-1',
        statut: 'absent',
      });

      await expect(
        service.signalerPassagerAbsent(
          'conducteur-1',
          'trajet-1',
          'passager-1',
        ),
      ).rejects.toThrow(ConflictException);
      expect(reservationUpdateMock).not.toHaveBeenCalled();
    });

    it('marks the reservation absent and decrements the note when eligible', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'termine',
      });
      reservationFindFirstMock.mockResolvedValueOnce({
        id: 'reservation-1',
        statut: 'confirmee',
      });
      utilisateurFindUniqueMock.mockResolvedValueOnce({
        id: 'passager-1',
        noteBrute: 4.0,
        penaliteCumulee: 0,
      });
      reservationUpdateMock.mockResolvedValueOnce({
        id: 'reservation-1',
        statut: 'absent',
      });

      const result = await service.signalerPassagerAbsent(
        'conducteur-1',
        'trajet-1',
        'passager-1',
      );

      expect(reservationUpdateMock).toHaveBeenCalledWith({
        where: { id: 'reservation-1' },
        data: { statut: 'absent' },
      });
      expect(utilisateurUpdateMock).toHaveBeenCalledWith({
        where: { id: 'passager-1' },
        data: { penaliteCumulee: 0.5, note: 3.5 },
      });
      expect(result).toEqual({ id: 'reservation-1', statut: 'absent' });
    });

    it('floors the note at MIN_NOTE instead of going lower', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'termine',
      });
      reservationFindFirstMock.mockResolvedValueOnce({
        id: 'reservation-1',
        statut: 'confirmee',
      });
      utilisateurFindUniqueMock.mockResolvedValueOnce({
        id: 'passager-1',
        noteBrute: 1.2,
        penaliteCumulee: 0,
      });
      reservationUpdateMock.mockResolvedValueOnce({
        id: 'reservation-1',
        statut: 'absent',
      });

      await service.signalerPassagerAbsent(
        'conducteur-1',
        'trajet-1',
        'passager-1',
      );

      expect(utilisateurUpdateMock).toHaveBeenCalledWith({
        where: { id: 'passager-1' },
        data: { penaliteCumulee: 0.5, note: 1 },
      });
    });

    it('accumulates the penalty even when the passager has never been rated', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'termine',
      });
      reservationFindFirstMock.mockResolvedValueOnce({
        id: 'reservation-1',
        statut: 'confirmee',
      });
      utilisateurFindUniqueMock.mockResolvedValueOnce({
        id: 'passager-1',
        noteBrute: null,
        penaliteCumulee: 0,
      });
      reservationUpdateMock.mockResolvedValueOnce({
        id: 'reservation-1',
        statut: 'absent',
      });

      await service.signalerPassagerAbsent(
        'conducteur-1',
        'trajet-1',
        'passager-1',
      );

      expect(utilisateurUpdateMock).toHaveBeenCalledWith({
        where: { id: 'passager-1' },
        data: { penaliteCumulee: 0.5, note: null },
      });
    });

    it('creates a Signalement for the passager (Story 7.1)', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'termine',
      });
      reservationFindFirstMock.mockResolvedValueOnce({
        id: 'reservation-1',
        statut: 'confirmee',
      });
      utilisateurFindUniqueMock.mockResolvedValueOnce({
        id: 'passager-1',
        note: null,
      });
      reservationUpdateMock.mockResolvedValueOnce({
        id: 'reservation-1',
        statut: 'absent',
      });

      await service.signalerPassagerAbsent(
        'conducteur-1',
        'trajet-1',
        'passager-1',
      );

      expect(signalementCreateMock).toHaveBeenCalledWith({
        data: {
          trajetId: 'trajet-1',
          type: 'no_show_passager',
          signaleParId: 'conducteur-1',
          concerneId: 'passager-1',
        },
      });
    });
  });

  describe('listerSignalements', () => {
    it('returns all signalements ordered by createdAt descending', async () => {
      signalementFindManyMock.mockResolvedValueOnce([]);

      await service.listerSignalements();

      expect(signalementFindManyMock).toHaveBeenCalledWith({
        include: {
          concerne: { select: { id: true, nom: true, prenom: true } },
          signalePar: { select: { id: true, nom: true, prenom: true } },
          trajet: { select: { id: true, heure: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('traiterSignalement', () => {
    it('throws NotFoundException when the signalement does not exist', async () => {
      signalementFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.traiterSignalement('signalement-missing'),
      ).rejects.toThrow(NotFoundException);
      expect(signalementUpdateMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the signalement is already "traite"', async () => {
      signalementFindUniqueMock.mockResolvedValueOnce({
        id: 'signalement-1',
        statut: 'traite',
      });

      await expect(service.traiterSignalement('signalement-1')).rejects.toThrow(
        ConflictException,
      );
      expect(signalementUpdateMock).not.toHaveBeenCalled();
    });

    it('marks the signalement as "traite" when eligible', async () => {
      signalementFindUniqueMock.mockResolvedValueOnce({
        id: 'signalement-1',
        statut: 'ouvert',
      });
      signalementUpdateMock.mockResolvedValueOnce({
        id: 'signalement-1',
        statut: 'traite',
      });

      const result = await service.traiterSignalement('signalement-1');

      expect(signalementUpdateMock).toHaveBeenCalledWith({
        where: { id: 'signalement-1' },
        data: { statut: 'traite' },
      });
      expect(result).toEqual({ id: 'signalement-1', statut: 'traite' });
    });
  });
});
