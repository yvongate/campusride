import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { NotationService } from './notation.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotationService', () => {
  let service: NotationService;
  let trajetFindUniqueMock: jest.Mock;
  let reservationFindFirstMock: jest.Mock;
  let notationFindFirstMock: jest.Mock;
  let notationCreateMock: jest.Mock;
  let notationFindManyMock: jest.Mock;
  let utilisateurUpdateMock: jest.Mock;
  let utilisateurFindUniqueOrThrowMock: jest.Mock;

  beforeEach(async () => {
    trajetFindUniqueMock = jest.fn();
    reservationFindFirstMock = jest.fn();
    notationFindFirstMock = jest.fn();
    notationCreateMock = jest.fn();
    notationFindManyMock = jest.fn().mockResolvedValue([]);
    utilisateurUpdateMock = jest.fn();
    utilisateurFindUniqueOrThrowMock = jest
      .fn()
      .mockResolvedValue({ penaliteCumulee: 0 });

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotationService,
        {
          provide: PrismaService,
          useValue: {
            trajet: { findUnique: trajetFindUniqueMock },
            reservation: { findFirst: reservationFindFirstMock },
            notation: {
              findFirst: notationFindFirstMock,
              create: notationCreateMock,
              findMany: notationFindManyMock,
            },
            utilisateur: {
              update: utilisateurUpdateMock,
              findUniqueOrThrow: utilisateurFindUniqueOrThrowMock,
            },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(NotationService);
  });

  describe('noterParticipant', () => {
    it('throws NotFoundException when the trajet does not exist', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.noterParticipant('conducteur-1', 'trajet-missing', {
          destinataireId: 'passager-1',
          etoiles: 5,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when the trajet is not "termine"', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
      });

      await expect(
        service.noterParticipant('conducteur-1', 'trajet-1', {
          destinataireId: 'passager-1',
          etoiles: 5,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException when rating oneself', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'termine',
      });

      await expect(
        service.noterParticipant('conducteur-1', 'trajet-1', {
          destinataireId: 'conducteur-1',
          etoiles: 5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when the noteur never participated', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'termine',
      });
      reservationFindFirstMock.mockResolvedValueOnce(null);

      await expect(
        service.noterParticipant('tiers-1', 'trajet-1', {
          destinataireId: 'conducteur-1',
          etoiles: 5,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when the destinataire never participated', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'termine',
      });
      // noteur (conducteur) OK -- pas d'appel a reservation.findFirst pour lui
      reservationFindFirstMock.mockResolvedValueOnce(null); // destinataire KO

      await expect(
        service.noterParticipant('conducteur-1', 'trajet-1', {
          destinataireId: 'tiers-1',
          etoiles: 5,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when the noteur already rated this destinataire for this trajet', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'termine',
      });
      reservationFindFirstMock.mockResolvedValueOnce({ id: 'reservation-1' });
      notationFindFirstMock.mockResolvedValueOnce({ id: 'notation-existante' });

      await expect(
        service.noterParticipant('conducteur-1', 'trajet-1', {
          destinataireId: 'passager-1',
          etoiles: 5,
        }),
      ).rejects.toThrow(ConflictException);
      expect(notationCreateMock).not.toHaveBeenCalled();
    });

    it('creates the Notation and recalculates the average note', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'termine',
      });
      reservationFindFirstMock.mockResolvedValueOnce({ id: 'reservation-1' });
      notationFindFirstMock.mockResolvedValueOnce(null);
      notationCreateMock.mockResolvedValueOnce({ id: 'notation-1' });
      notationFindManyMock.mockResolvedValueOnce([
        { etoiles: 5 },
        { etoiles: 3 },
      ]);

      const result = await service.noterParticipant(
        'conducteur-1',
        'trajet-1',
        {
          destinataireId: 'passager-1',
          etoiles: 5,
          commentaire: 'Tres ponctuel',
        },
      );

      expect(notationCreateMock).toHaveBeenCalledWith({
        data: {
          trajetId: 'trajet-1',
          noteurId: 'conducteur-1',
          destinataireId: 'passager-1',
          etoiles: 5,
          commentaire: 'Tres ponctuel',
        },
      });
      expect(utilisateurUpdateMock).toHaveBeenCalledWith({
        where: { id: 'passager-1' },
        data: { noteBrute: 4, nombreNotations: 2, note: 4 },
      });
      expect(result).toEqual({ id: 'notation-1' });
    });

    it('subtracts the accumulated penalty from the fresh average instead of overwriting it', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'termine',
      });
      reservationFindFirstMock.mockResolvedValueOnce({ id: 'reservation-1' });
      notationFindFirstMock.mockResolvedValueOnce(null);
      notationCreateMock.mockResolvedValueOnce({ id: 'notation-1' });
      notationFindManyMock.mockResolvedValueOnce([
        { etoiles: 5 },
        { etoiles: 3 },
      ]);
      utilisateurFindUniqueOrThrowMock.mockResolvedValueOnce({
        penaliteCumulee: 1.5,
      });

      await service.noterParticipant('conducteur-1', 'trajet-1', {
        destinataireId: 'passager-1',
        etoiles: 5,
      });

      expect(utilisateurUpdateMock).toHaveBeenCalledWith({
        where: { id: 'passager-1' },
        data: { noteBrute: 4, nombreNotations: 2, note: 2.5 },
      });
    });

    it('sets noteBrute and nombreNotations back to null/0 if no notation remains (defensive, not currently reachable)', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'termine',
      });
      reservationFindFirstMock.mockResolvedValueOnce({ id: 'reservation-1' });
      notationFindFirstMock.mockResolvedValueOnce(null);
      notationCreateMock.mockResolvedValueOnce({ id: 'notation-1' });
      notationFindManyMock.mockResolvedValueOnce([]);

      await service.noterParticipant('conducteur-1', 'trajet-1', {
        destinataireId: 'passager-1',
        etoiles: 5,
      });

      expect(utilisateurUpdateMock).toHaveBeenCalledWith({
        where: { id: 'passager-1' },
        data: { noteBrute: null, nombreNotations: 0, note: null },
      });
    });
  });

  describe('listerNotationsTrajet', () => {
    it('throws NotFoundException when the trajet does not exist', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.listerNotationsTrajet('user-1', 'trajet-missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for a non-participant', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'termine',
      });
      reservationFindFirstMock.mockResolvedValueOnce(null);

      await expect(
        service.listerNotationsTrajet('tiers-1', 'trajet-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(notationFindManyMock).not.toHaveBeenCalled();
    });

    it('returns the notations for a participant', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'termine',
      });

      await service.listerNotationsTrajet('conducteur-1', 'trajet-1');

      expect(notationFindManyMock).toHaveBeenCalledWith({
        where: { trajetId: 'trajet-1' },
        include: {
          noteur: { select: { id: true, nom: true, prenom: true } },
          destinataire: { select: { id: true, nom: true, prenom: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
    });
  });
});
