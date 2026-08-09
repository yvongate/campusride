import { Test } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MessagerieService } from './messagerie.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MessagerieService', () => {
  let service: MessagerieService;
  let trajetFindUniqueMock: jest.Mock;
  let reservationFindFirstMock: jest.Mock;
  let messageCreateMock: jest.Mock;
  let messageFindManyMock: jest.Mock;
  let messageDeleteManyMock: jest.Mock;

  beforeEach(async () => {
    trajetFindUniqueMock = jest.fn();
    reservationFindFirstMock = jest.fn();
    messageCreateMock = jest.fn();
    messageFindManyMock = jest.fn();
    messageDeleteManyMock = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagerieService,
        {
          provide: PrismaService,
          useValue: {
            trajet: { findUnique: trajetFindUniqueMock },
            reservation: { findFirst: reservationFindFirstMock },
            message: {
              create: messageCreateMock,
              findMany: messageFindManyMock,
              deleteMany: messageDeleteManyMock,
            },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(MessagerieService);
  });

  describe('envoyerMessage', () => {
    it('throws NotFoundException when the trajet does not exist', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce(null);

      await expect(
        service.envoyerMessage('user-1', 'trajet-missing', {
          contenu: 'Salut',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(messageCreateMock).not.toHaveBeenCalled();
    });

    it('allows the conducteur to send a message', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
      });
      messageCreateMock.mockResolvedValueOnce({ id: 'message-1' });

      const result = await service.envoyerMessage('conducteur-1', 'trajet-1', {
        contenu: 'On se retrouve au carrefour',
      });

      expect(reservationFindFirstMock).not.toHaveBeenCalled();
      expect(messageCreateMock).toHaveBeenCalledWith({
        data: {
          trajetId: 'trajet-1',
          expediteurId: 'conducteur-1',
          contenu: 'On se retrouve au carrefour',
        },
      });
      expect(result).toEqual({ id: 'message-1' });
    });

    it('allows a confirmed passager to send a message', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
      });
      reservationFindFirstMock.mockResolvedValueOnce({ id: 'reservation-1' });
      messageCreateMock.mockResolvedValueOnce({ id: 'message-2' });

      await service.envoyerMessage('passager-1', 'trajet-1', {
        contenu: "J'arrive dans 5 min",
      });

      expect(reservationFindFirstMock).toHaveBeenCalledWith({
        where: {
          trajetId: 'trajet-1',
          passagerId: 'passager-1',
          statut: 'confirmee',
        },
      });
      expect(messageCreateMock).toHaveBeenCalled();
    });

    it('throws ForbiddenException for a non-participant', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
      });
      reservationFindFirstMock.mockResolvedValueOnce(null);

      await expect(
        service.envoyerMessage('tiers-1', 'trajet-1', { contenu: 'Salut' }),
      ).rejects.toThrow(ForbiddenException);
      expect(messageCreateMock).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the trajet is "termine"', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'termine',
      });

      await expect(
        service.envoyerMessage('conducteur-1', 'trajet-1', {
          contenu: 'Salut',
        }),
      ).rejects.toThrow(ConflictException);
      expect(messageCreateMock).not.toHaveBeenCalled();
    });
  });

  describe('listerMessages', () => {
    it('throws ForbiddenException for a non-participant', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
      });
      reservationFindFirstMock.mockResolvedValueOnce(null);

      await expect(
        service.listerMessages('tiers-1', 'trajet-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(messageFindManyMock).not.toHaveBeenCalled();
    });

    it('returns messages ordered by createdAt ascending', async () => {
      trajetFindUniqueMock.mockResolvedValueOnce({
        id: 'trajet-1',
        conducteurId: 'conducteur-1',
        statut: 'ouvert',
      });
      messageFindManyMock.mockResolvedValueOnce([]);

      await service.listerMessages('conducteur-1', 'trajet-1');

      expect(messageFindManyMock).toHaveBeenCalledWith({
        where: { trajetId: 'trajet-1' },
        include: {
          expediteur: { select: { id: true, nom: true, prenom: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('supprimerChatTrajet', () => {
    it('deletes all messages for the given trajetId', async () => {
      await service.supprimerChatTrajet('trajet-1');

      expect(messageDeleteManyMock).toHaveBeenCalledWith({
        where: { trajetId: 'trajet-1' },
      });
    });
  });
});
