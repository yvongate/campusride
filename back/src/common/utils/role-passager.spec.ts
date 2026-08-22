import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { verifierPeutEtrePassager } from './role-passager';

describe('verifierPeutEtrePassager', () => {
  function prismaAvecRole(role: string | null) {
    return {
      utilisateur: {
        findUnique: jest.fn().mockResolvedValue(role ? { role } : null),
      },
    } as unknown as PrismaService;
  }

  it('refuse un compte "chauffeur"', async () => {
    await expect(
      verifierPeutEtrePassager(prismaAvecRole('chauffeur'), 'user-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('laisse passer un etudiant', async () => {
    await expect(
      verifierPeutEtrePassager(prismaAvecRole('etudiant'), 'user-1'),
    ).resolves.toBeUndefined();
  });

  // "les deux" est etudiant ET conducteur : il garde tous ses droits de
  // passager, c'est precisement ce qui le distingue de "chauffeur".
  it('laisse passer un compte "les deux"', async () => {
    await expect(
      verifierPeutEtrePassager(prismaAvecRole('les deux'), 'user-1'),
    ).resolves.toBeUndefined();
  });

  // Un compte introuvable n'est pas rejete ici : les methodes appelantes ont
  // leurs propres controles, et transformer ce cas en 403 masquerait la vraie
  // erreur derriere un message trompeur.
  it('ne se prononce pas sur un compte introuvable', async () => {
    await expect(
      verifierPeutEtrePassager(prismaAvecRole(null), 'inconnu'),
    ).resolves.toBeUndefined();
  });
});
