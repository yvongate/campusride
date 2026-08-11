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

  const validDto = {
    universiteId: 'univ-1',
    pointDeRdvId: 'poi-1',
    heure: '2026-09-01T07:00:00.000Z',
    places: 3,
    prixTotal: 3500,
  };

  beforeEach(async () => {
    universiteFindUniqueMock = jest.fn();
    poiFindUniqueMock = jest.fn();
    utilisateurFindUniqueMock = jest.fn();
    trajetFindFirstMock = jest.fn();
    trajetCreateMock = jest.fn();
    trajetFindManyMock = jest.fn();
    trajetFindUniqueMock = jest.fn();
    reservationCountMock = jest.fn();
    reservationFindFirstMock = jest.fn();
    reservationCreateMock = jest.fn();
    reservationUpdateManyMock = jest.fn();
    reservationUpdateMock = jest.fn();
    transactionMock = jest.fn((ops: Promise<unknown>[]) => Promise.all(ops));
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
        {
          provide: PrismaService,
          useValue: {
            universite: { findUnique: universiteFindUniqueMock },
            pointInteret: { findUnique: poiFindUniqueMock },
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
        prixTotal: 3500,
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

  describe('listerTrajets', () => {
    const query = { universiteId: 'univ-1', communeId: 'commune-1' };

    it('builds the correct where/orderBy and marks the conducteur as verifie', async () => {
      trajetFindManyMock.mockResolvedValueOnce([
        {
          id: 'trajet-1',
          heure: new Date('2026-09-01T07:00:00.000Z'),
          pointDeRdv: { latitude: 5.36, longitude: -3.98 },
          conducteur: {
            id: 'conducteur-1',
            nom: 'Kone',
            prenom: null,
            note: 4.5,
          },
        },
      ]);

      const result = await service.listerTrajets(query);

      expect(trajetFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            universiteId: 'univ-1',
            statut: 'ouvert',
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
          pointDeRdv: { latitude: 5.36, longitude: -3.98 },
          conducteur: { id: 'c1', nom: null, prenom: null, note: null },
        },
        {
          id: 'trajet-late',
          heure: new Date('2026-09-01T09:00:00.000Z'),
          pointDeRdv: { latitude: 5.4, longitude: -4.0 },
          conducteur: { id: 'c2', nom: null, prenom: null, note: null },
        },
      ]);

      const result = await service.listerTrajets(query);

      expect(result.map((t) => t.id)).toEqual(['trajet-early', 'trajet-late']);
    });

    it('sorts by distance to the given lat/lng when provided', async () => {
      trajetFindManyMock.mockResolvedValueOnce([
        {
          id: 'trajet-loin',
          heure: new Date('2026-09-01T06:00:00.000Z'),
          pointDeRdv: { latitude: 5.5, longitude: -4.2 },
          conducteur: { id: 'c1', nom: null, prenom: null, note: null },
        },
        {
          id: 'trajet-proche',
          heure: new Date('2026-09-01T09:00:00.000Z'),
          pointDeRdv: { latitude: 5.3601, longitude: -3.9701 },
          conducteur: { id: 'c2', nom: null, prenom: null, note: null },
        },
      ]);

      const result = await service.listerTrajets({
        ...query,
        lat: 5.36,
        lng: -3.97,
      });

      expect(result.map((t) => t.id)).toEqual(['trajet-proche', 'trajet-loin']);
      const [proche, loin] = result as unknown as { distanceKm: number }[];
      expect(proche.distanceKm).toBeLessThan(loin.distanceKm);
    });
  });

  describe('getTrajetDetail', () => {
    it('throws NotFoundException when the trajet does not exist', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce(null);

      await expect(service.getTrajetDetail('trajet-missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('computes placesDisponibles and a division-by-zero-safe price preview', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        places: 4,
        prixTotal: 3500,
        conducteur: { id: 'c1', nom: null, prenom: null, note: null },
      });
      reservationCountMock.mockResolvedValueOnce(0);

      const result = await service.getTrajetDetail('trajet-1');

      expect(result.placesDisponibles).toBe(4);
      // 3500 / (0 + 1) = 3500, deja entier -> pas d'arrondi
      expect(result.prixParPersonnePreview).toBe(3500);
      expect(result.conducteur.verifie).toBe(true);
    });

    it('previews the price as if the requester joined as one more passenger', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        places: 4,
        prixTotal: 3500,
        conducteur: { id: 'c1', nom: null, prenom: null, note: null },
      });
      reservationCountMock.mockResolvedValueOnce(3);

      const result = await service.getTrajetDetail('trajet-1');

      expect(result.placesDisponibles).toBe(1);
      // 3500 / (3 + 1) = 875, deja entier (exemple du cahier des charges)
      expect(result.prixParPersonnePreview).toBe(875);
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
        prixTotal: 3500,
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
        places: 4,
        prixTotal: 3500,
      });

      await expect(
        service.reserverTrajet('conducteur-1', 'trajet-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the passager already has a confirmed reservation', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        places: 4,
        prixTotal: 3500,
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
        places: 2,
        prixTotal: 3500,
      });
      reservationFindFirstMock.mockResolvedValueOnce(null);
      reservationCountMock.mockResolvedValueOnce(2);

      await expect(
        service.reserverTrajet('passager-1', 'trajet-1'),
      ).rejects.toThrow(ConflictException);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('creates the reservation and synchronises the price on existing reservations', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
        places: 4,
        prixTotal: 3500,
      });
      reservationFindFirstMock.mockResolvedValueOnce(null);
      reservationCountMock.mockResolvedValueOnce(3);
      reservationCreateMock.mockResolvedValueOnce({
        id: 'reservation-nouvelle',
        prixParPersonne: 875,
      });
      reservationUpdateManyMock.mockResolvedValueOnce({ count: 3 });

      const result = await service.reserverTrajet('passager-4', 'trajet-1');

      expect(reservationCreateMock).toHaveBeenCalledWith({
        data: {
          trajetId: 'trajet-1',
          passagerId: 'passager-4',
          prixParPersonne: 875,
          statut: 'confirmee',
        },
      });
      expect(reservationUpdateManyMock).toHaveBeenCalledWith({
        where: { trajetId: 'trajet-1', statut: 'confirmee' },
        data: { prixParPersonne: 875 },
      });
      expect(transactionMock).toHaveBeenCalled();
      expect(result).toEqual({
        id: 'reservation-nouvelle',
        prixParPersonne: 875,
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
        note: 4.0,
      });
      reservationFindManyMock.mockResolvedValueOnce([]);

      await service.annulerTrajet('conducteur-1', 'trajet-1');

      expect(utilisateurUpdateMock).toHaveBeenCalledWith({
        where: { id: 'conducteur-1' },
        data: { note: 3.5 },
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
        note: 1.2,
      });
      reservationFindManyMock.mockResolvedValueOnce([]);

      await service.annulerTrajet('conducteur-1', 'trajet-1');

      expect(utilisateurUpdateMock).toHaveBeenCalledWith({
        where: { id: 'conducteur-1' },
        data: { note: 1 },
      });
    });

    it('does not touch the note when the conducteur has never been rated (note is null)', async () => {
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
        note: null,
      });
      reservationFindManyMock.mockResolvedValueOnce([]);

      await service.annulerTrajet('conducteur-1', 'trajet-1');

      expect(utilisateurUpdateMock).not.toHaveBeenCalled();
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
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.annulerTrajet('conducteur-1', 'trajet-1');

      expect(reservationFindManyMock).toHaveBeenCalledWith({
        where: { trajetId: 'trajet-1', statut: 'confirmee' },
        select: { passagerId: true },
      });
      expect(loggerSpy).toHaveBeenCalledTimes(2);
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

    it('throws ConflictException when less than 2h remain before departure', async () => {
      reservationFindFirstMock.mockResolvedValueOnce({
        id: 'reservation-1',
        trajetId: 'trajet-1',
        passagerId: 'passager-1',
        trajet: { id: 'trajet-1', heure: heureProche, prixTotal: 3500 },
      });

      await expect(
        service.annulerReservation('passager-1', 'trajet-1'),
      ).rejects.toThrow(ConflictException);
      expect(reservationUpdateMock).not.toHaveBeenCalled();
    });

    it('cancels the reservation without recalculating price when no one else remains', async () => {
      reservationFindFirstMock.mockResolvedValueOnce({
        id: 'reservation-1',
        trajetId: 'trajet-1',
        passagerId: 'passager-1',
        trajet: { id: 'trajet-1', heure: heureLointaine, prixTotal: 3500 },
      });
      reservationCountMock.mockResolvedValueOnce(0);
      reservationUpdateMock.mockResolvedValueOnce({
        id: 'reservation-1',
        statut: 'annulee',
      });

      const result = await service.annulerReservation('passager-1', 'trajet-1');

      expect(reservationCountMock).toHaveBeenCalledWith({
        where: {
          trajetId: 'trajet-1',
          statut: 'confirmee',
          id: { not: 'reservation-1' },
        },
      });
      expect(reservationUpdateMock).toHaveBeenCalledWith({
        where: { id: 'reservation-1' },
        data: { statut: 'annulee' },
      });
      expect(reservationUpdateManyMock).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'reservation-1', statut: 'annulee' });
    });

    it('recalculates the price for the remaining confirmed passagers', async () => {
      reservationFindFirstMock.mockResolvedValueOnce({
        id: 'reservation-1',
        trajetId: 'trajet-1',
        passagerId: 'passager-1',
        trajet: { id: 'trajet-1', heure: heureLointaine, prixTotal: 3500 },
      });
      reservationCountMock.mockResolvedValueOnce(2);
      reservationUpdateMock.mockResolvedValueOnce({
        id: 'reservation-1',
        statut: 'annulee',
      });

      await service.annulerReservation('passager-1', 'trajet-1');

      expect(reservationUpdateManyMock).toHaveBeenCalledWith({
        where: { trajetId: 'trajet-1', statut: 'confirmee' },
        data: { prixParPersonne: 1750 },
      });
    });

    it('logs one notification', async () => {
      reservationFindFirstMock.mockResolvedValueOnce({
        id: 'reservation-1',
        trajetId: 'trajet-1',
        passagerId: 'passager-1',
        trajet: { id: 'trajet-1', heure: heureLointaine, prixTotal: 3500 },
      });
      reservationCountMock.mockResolvedValueOnce(0);
      reservationUpdateMock.mockResolvedValueOnce({
        id: 'reservation-1',
        statut: 'annulee',
      });
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.annulerReservation('passager-1', 'trajet-1');

      expect(loggerSpy).toHaveBeenCalledTimes(1);
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
        note: 4.0,
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
        data: { note: 3 },
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
        note: 1.5,
      });
      trajetUpdateMock.mockResolvedValueOnce({
        id: 'trajet-1',
        statut: 'annule',
      });
      reservationFindManyMock.mockResolvedValueOnce([]);

      await service.signalerNoShow('passager-1', 'trajet-1');

      expect(utilisateurUpdateMock).toHaveBeenCalledWith({
        where: { id: 'conducteur-1' },
        data: { note: 1 },
      });
    });

    it('does not touch the note when the conducteur has never been rated', async () => {
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
        note: null,
      });
      trajetUpdateMock.mockResolvedValueOnce({
        id: 'trajet-1',
        statut: 'annule',
      });
      reservationFindManyMock.mockResolvedValueOnce([]);

      await service.signalerNoShow('passager-1', 'trajet-1');

      expect(utilisateurUpdateMock).not.toHaveBeenCalled();
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
        note: null,
      });
      trajetUpdateMock.mockResolvedValueOnce({
        id: 'trajet-1',
        statut: 'annule',
      });
      reservationFindManyMock.mockResolvedValueOnce([
        { passagerId: 'passager-1' },
        { passagerId: 'passager-2' },
      ]);
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.signalerNoShow('passager-1', 'trajet-1');

      expect(loggerSpy).toHaveBeenCalledTimes(2);
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
        note: null,
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
      const loggerSpy = jest.spyOn(service['logger'], 'log');

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
      expect(loggerSpy).toHaveBeenCalledTimes(2);
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
        note: 4.0,
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
        data: { note: 3.5 },
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
        note: 1.2,
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
        data: { note: 1 },
      });
    });

    it('does not touch the note when the passager has never been rated', async () => {
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

      expect(utilisateurUpdateMock).not.toHaveBeenCalled();
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
