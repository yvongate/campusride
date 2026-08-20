import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SupportService } from './support.service';

describe('SupportService', () => {
  let prisma: {
    messageSupport: {
      count: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let envoyer: jest.Mock;
  let service: SupportService;

  beforeEach(() => {
    prisma = {
      messageSupport: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'm1' }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'm1', statut: 'traite' }),
      },
    };
    envoyer = jest.fn().mockResolvedValue(undefined);
    service = new SupportService(
      prisma as unknown as PrismaService,
      { envoyer } as unknown as NotificationsService,
    );
  });

  describe('creerMessage', () => {
    it('enregistre le message', async () => {
      await service.creerMessage('u1', 'Je pense que ma suspension est une erreur');

      expect(prisma.messageSupport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            userId: 'u1',
            contenu: 'Je pense que ma suspension est une erreur',
          },
        }),
      );
    });

    it('refuse au-dela de 3 messages encore sans reponse', async () => {
      prisma.messageSupport.count.mockResolvedValueOnce(3);

      await expect(service.creerMessage('u1', 'un message assez long')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.messageSupport.create).not.toHaveBeenCalled();
    });

    // Le plafond porte sur les messages OUVERTS : une fois repondu, la
    // personne doit pouvoir revenir, sinon un compte devient muet a vie.
    it('ne compte que les messages ouverts', async () => {
      await service.creerMessage('u1', 'un message assez long');

      expect(prisma.messageSupport.count).toHaveBeenCalledWith({
        where: { userId: 'u1', statut: 'ouvert' },
      });
    });
  });

  describe('lister', () => {
    it('remonte les messages ouverts en tete', async () => {
      prisma.messageSupport.findMany.mockResolvedValueOnce([
        { id: 'a', statut: 'traite' },
        { id: 'b', statut: 'ouvert' },
        { id: 'c', statut: 'traite' },
        { id: 'd', statut: 'ouvert' },
      ]);

      const resultat = await service.lister();

      expect(resultat.map((m) => m.id)).toEqual(['b', 'd', 'a', 'c']);
    });
  });

  describe('repondre', () => {
    it('marque le message traite et notifie son auteur', async () => {
      prisma.messageSupport.findUnique.mockResolvedValueOnce({
        id: 'm1',
        userId: 'u1',
        statut: 'ouvert',
      });

      await service.repondre('m1', 'Ta suspension a ete levee.');

      expect(prisma.messageSupport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'm1' },
          data: expect.objectContaining({
            reponse: 'Ta suspension a ete levee.',
            statut: 'traite',
          }),
        }),
      );
      expect(envoyer).toHaveBeenCalledWith(
        ['u1'],
        expect.any(String),
        expect.any(String),
        { type: 'support' },
      );
    });

    it('refuse un message inconnu', async () => {
      prisma.messageSupport.findUnique.mockResolvedValueOnce(null);

      await expect(service.repondre('inconnu', 'bonjour')).rejects.toThrow(
        NotFoundException,
      );
    });

    // Evite qu'un double-clic dans le back-office ecrase la premiere reponse
    // et renotifie l'utilisateur pour rien.
    it('refuse de repondre deux fois', async () => {
      prisma.messageSupport.findUnique.mockResolvedValueOnce({
        id: 'm1',
        userId: 'u1',
        statut: 'traite',
      });

      await expect(service.repondre('m1', 'bonjour')).rejects.toThrow(
        BadRequestException,
      );
      expect(envoyer).not.toHaveBeenCalled();
    });
  });
});
