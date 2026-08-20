import { Test } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

// Le vrai client Expo ferait de vrais appels reseau : on le remplace pour
// controler tickets et erreurs.
const chunkMock = jest.fn();
const sendMock = jest.fn();
const isExpoPushTokenMock = jest.fn();

jest.mock('expo-server-sdk', () => ({
  Expo: Object.assign(
    jest.fn().mockImplementation(() => ({
      chunkPushNotifications: chunkMock,
      sendPushNotificationsAsync: sendMock,
    })),
    { isExpoPushToken: (token: string) => isExpoPushTokenMock(token) },
  ),
}));

describe('NotificationsService', () => {
  let service: NotificationsService;
  let appareilFindManyMock: jest.Mock;
  let appareilUpsertMock: jest.Mock;
  let appareilDeleteManyMock: jest.Mock;

  beforeEach(async () => {
    chunkMock.mockReset();
    sendMock.mockReset();
    isExpoPushTokenMock.mockReset().mockReturnValue(true);
    appareilFindManyMock = jest.fn().mockResolvedValue([]);
    appareilUpsertMock = jest.fn();
    appareilDeleteManyMock = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: {
            appareilPush: {
              findMany: appareilFindManyMock,
              upsert: appareilUpsertMock,
              deleteMany: appareilDeleteManyMock,
            },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(NotificationsService);
  });

  describe('enregistrerAppareil', () => {
    it('rattache un token deja connu au nouveau compte au lieu de le dupliquer', async () => {
      await service.enregistrerAppareil('user-1', 'ExponentPushToken[abc]', 'android');

      expect(appareilUpsertMock).toHaveBeenCalledWith({
        where: { token: 'ExponentPushToken[abc]' },
        update: { userId: 'user-1', plateforme: 'android' },
        create: {
          userId: 'user-1',
          token: 'ExponentPushToken[abc]',
          plateforme: 'android',
        },
      });
    });

    it('ignore un token qui n\'est pas un token Expo valide', async () => {
      isExpoPushTokenMock.mockReturnValue(false);

      await service.enregistrerAppareil('user-1', 'n-importe-quoi', 'android');

      expect(appareilUpsertMock).not.toHaveBeenCalled();
    });
  });

  describe('envoyer', () => {
    it('n\'interroge pas la base quand il n\'y a aucun destinataire', async () => {
      await service.envoyer([], 'Titre', 'Corps');

      expect(appareilFindManyMock).not.toHaveBeenCalled();
    });

    it('ne fait rien de plus quand les destinataires n\'ont aucun appareil', async () => {
      appareilFindManyMock.mockResolvedValueOnce([]);

      await service.envoyer(['user-1'], 'Titre', 'Corps');

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('envoie un message par appareil des destinataires', async () => {
      appareilFindManyMock.mockResolvedValueOnce([
        { token: 'ExponentPushToken[a]' },
        { token: 'ExponentPushToken[b]' },
      ]);
      chunkMock.mockImplementation((messages: unknown[]) => [messages]);
      sendMock.mockResolvedValueOnce([{ status: 'ok' }, { status: 'ok' }]);

      await service.envoyer(['user-1', 'user-2'], 'Titre', 'Corps', {
        type: 'trajet',
        id: 'trajet-1',
      });

      expect(sendMock).toHaveBeenCalledWith([
        expect.objectContaining({
          to: 'ExponentPushToken[a]',
          title: 'Titre',
          body: 'Corps',
          data: { type: 'trajet', id: 'trajet-1' },
        }),
        expect.objectContaining({ to: 'ExponentPushToken[b]' }),
      ]);
    });

    it('supprime les tokens signales "DeviceNotRegistered" par Expo', async () => {
      appareilFindManyMock.mockResolvedValueOnce([
        { token: 'ExponentPushToken[mort]' },
        { token: 'ExponentPushToken[vivant]' },
      ]);
      chunkMock.mockImplementation((messages: unknown[]) => [messages]);
      sendMock.mockResolvedValueOnce([
        { status: 'error', message: 'x', details: { error: 'DeviceNotRegistered' } },
        { status: 'ok' },
      ]);

      await service.envoyer(['user-1'], 'Titre', 'Corps');

      // Sans ce nettoyage, la table accumulerait indefiniment des tokens
      // d'applications desinstallees.
      expect(appareilDeleteManyMock).toHaveBeenCalledWith({
        where: { token: { in: ['ExponentPushToken[mort]'] } },
      });
    });

    it('conserve les tokens rejetes pour une autre raison', async () => {
      appareilFindManyMock.mockResolvedValueOnce([{ token: 'ExponentPushToken[a]' }]);
      chunkMock.mockImplementation((messages: unknown[]) => [messages]);
      sendMock.mockResolvedValueOnce([
        { status: 'error', message: 'trop gros', details: { error: 'MessageTooBig' } },
      ]);

      await service.envoyer(['user-1'], 'Titre', 'Corps');

      expect(appareilDeleteManyMock).not.toHaveBeenCalled();
    });

    it('ne propage jamais une panne du service Expo', async () => {
      appareilFindManyMock.mockResolvedValueOnce([{ token: 'ExponentPushToken[a]' }]);
      chunkMock.mockImplementation((messages: unknown[]) => [messages]);
      sendMock.mockRejectedValueOnce(new Error('Expo indisponible'));

      // Une notification est un effet de bord : si elle echouait bruyamment,
      // elle ferait echouer l'annulation ou la reservation qui l'a declenchee.
      await expect(
        service.envoyer(['user-1'], 'Titre', 'Corps'),
      ).resolves.toBeUndefined();
    });
  });
});
