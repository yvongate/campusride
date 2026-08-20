import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

describe('JwtStrategy', () => {
  let findUniqueMock: jest.Mock;
  let strategy: JwtStrategy;

  beforeEach(() => {
    const config = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;
    findUniqueMock = jest.fn().mockResolvedValue(null);
    const prisma = {
      utilisateur: { findUnique: findUniqueMock },
    } as unknown as PrismaService;
    strategy = new JwtStrategy(config, prisma);
  });

  it('maps a decoded payload to { userId, role, suspenduJusqua } when the account is not suspended', async () => {
    findUniqueMock.mockResolvedValueOnce({ actif: true, suspenduJusqua: null });

    const result = await strategy.validate({ sub: 'user-1', role: 'etudiant' });

    expect(result).toEqual({
      userId: 'user-1',
      role: 'etudiant',
      suspenduJusqua: null,
    });
  });

  it('allows the request when suspenduJusqua is in the past', async () => {
    const suspenduJusqua = new Date(Date.now() - 1000);
    findUniqueMock.mockResolvedValueOnce({ actif: true, suspenduJusqua });

    const result = await strategy.validate({ sub: 'user-1', role: 'etudiant' });

    expect(result).toEqual({
      userId: 'user-1',
      role: 'etudiant',
      suspenduJusqua,
    });
  });

  // La suspension n'est plus un rejet ici : elle est seulement transmise, et
  // c'est JwtAuthGuard qui tranche route par route (voir jwt-auth.guard.spec).
  // Sans ca, un compte suspendu ne pourrait pas joindre le support.
  it('does not reject a suspended account but reports the suspension', async () => {
    const suspenduJusqua = new Date(Date.now() + 1000);
    findUniqueMock.mockResolvedValueOnce({ actif: true, suspenduJusqua });

    const result = await strategy.validate({ sub: 'user-1', role: 'etudiant' });

    expect(result).toEqual({
      userId: 'user-1',
      role: 'etudiant',
      suspenduJusqua,
    });
  });

  it('throws UnauthorizedException when the account was deactivated by an admin', async () => {
    findUniqueMock.mockResolvedValueOnce({
      actif: false,
      suspenduJusqua: null,
    });

    await expect(
      strategy.validate({ sub: 'user-1', role: 'etudiant' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
