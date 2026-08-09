import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

const bcryptCompareMock = jest.fn<Promise<boolean>, [string, string]>();
jest.mock('bcryptjs', () => ({
  hashSync: jest.fn(() => 'dummy-hash'),
  compare: (password: string, hash: string) =>
    bcryptCompareMock(password, hash),
}));

interface FakeUser {
  id: string;
  telephone: string;
  role: string;
}

interface FakeAdminUser {
  id: string;
  email: string;
  role: string;
  passwordHash: string | null;
}

describe('AuthService', () => {
  let service: AuthService;
  let upsertMock: jest.Mock<Promise<FakeUser>, [unknown]>;
  let findUniqueMock: jest.Mock<Promise<FakeAdminUser | null>, [unknown]>;
  let signAsyncMock: jest.Mock<Promise<string>, [unknown]>;

  beforeEach(async () => {
    bcryptCompareMock.mockReset();
    upsertMock = jest.fn<Promise<FakeUser>, [unknown]>();
    findUniqueMock = jest.fn<Promise<FakeAdminUser | null>, [unknown]>();
    signAsyncMock = jest
      .fn<Promise<string>, [unknown]>()
      .mockResolvedValue('signed.jwt.token');

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            utilisateur: { upsert: upsertMock, findUnique: findUniqueMock },
          },
        },
        { provide: JwtService, useValue: { signAsync: signAsyncMock } },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('requestOtp', () => {
    it('generates a 6-digit code and returns it', () => {
      const result = service.requestOtp('+2250700000000');

      expect(result.code).toMatch(/^\d{6}$/);
    });
  });

  describe('verifyOtp', () => {
    function requestAndCaptureCode(phone: string): string {
      return service.requestOtp(phone).code;
    }

    it('creates a new user and returns a JWT when the code is correct', async () => {
      const phone = '+2250700000001';
      const code = requestAndCaptureCode(phone);
      upsertMock.mockResolvedValueOnce({
        id: 'user-1',
        telephone: phone,
        role: 'etudiant',
      });

      const result = await service.verifyOtp(phone, code);

      expect(upsertMock).toHaveBeenCalledWith({
        where: { telephone: phone },
        update: {},
        create: { telephone: phone, role: 'etudiant' },
      });
      expect(signAsyncMock).toHaveBeenCalledWith({
        sub: 'user-1',
        role: 'etudiant',
      });
      expect(result).toEqual({
        accessToken: 'signed.jwt.token',
        user: { id: 'user-1', telephone: phone, role: 'etudiant' },
      });
    });

    it('throws UnauthorizedException and keeps the code when it is incorrect', async () => {
      const phone = '+2250700000002';
      requestAndCaptureCode(phone);

      await expect(service.verifyOtp(phone, '000000')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(upsertMock).not.toHaveBeenCalled();

      // the code is still valid for a retry
      upsertMock.mockResolvedValueOnce({
        id: 'user-2',
        telephone: phone,
        role: 'etudiant',
      });
      const realCode = requestAndCaptureCode(phone);
      await expect(service.verifyOtp(phone, realCode)).resolves.toBeDefined();
    });

    it('throws UnauthorizedException when no code was requested for this phone', async () => {
      await expect(
        service.verifyOtp('+2250700000003', '123456'),
      ).rejects.toThrow(UnauthorizedException);
      expect(upsertMock).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the code has expired', async () => {
      const phone = '+2250700000004';
      const code = requestAndCaptureCode(phone);

      const realNow = Date.now;
      Date.now = () => realNow() + 6 * 60 * 1000; // 6 minutes later, TTL is 5
      try {
        await expect(service.verifyOtp(phone, code)).rejects.toThrow(
          UnauthorizedException,
        );
      } finally {
        Date.now = realNow;
      }
    });
  });

  describe('loginAdmin', () => {
    it('returns a JWT when the credentials are correct', async () => {
      findUniqueMock.mockResolvedValueOnce({
        id: 'admin-1',
        email: 'admin@campusride.ci',
        role: 'admin',
        passwordHash: 'stored-hash',
      });
      bcryptCompareMock.mockResolvedValueOnce(true);

      const result = await service.loginAdmin(
        'admin@campusride.ci',
        'good-password',
      );

      expect(bcryptCompareMock).toHaveBeenCalledWith(
        'good-password',
        'stored-hash',
      );
      expect(signAsyncMock).toHaveBeenCalledWith({
        sub: 'admin-1',
        role: 'admin',
      });
      expect(result).toEqual({
        accessToken: 'signed.jwt.token',
        user: { id: 'admin-1', email: 'admin@campusride.ci', role: 'admin' },
      });
    });

    it('throws a generic UnauthorizedException and still calls bcrypt.compare when the email is unknown', async () => {
      findUniqueMock.mockResolvedValueOnce(null);
      bcryptCompareMock.mockResolvedValueOnce(false);

      await expect(
        service.loginAdmin('unknown@campusride.ci', 'whatever'),
      ).rejects.toThrow(UnauthorizedException);

      // garde-fou anti-timing-leak : bcrypt.compare doit tourner meme si
      // aucun utilisateur n'a ete trouve, contre un hash factice
      expect(bcryptCompareMock).toHaveBeenCalledWith(
        'whatever',
        expect.any(String),
      );
      expect(signAsyncMock).not.toHaveBeenCalled();
    });

    it('throws a generic UnauthorizedException when the password is wrong', async () => {
      findUniqueMock.mockResolvedValueOnce({
        id: 'admin-1',
        email: 'admin@campusride.ci',
        role: 'admin',
        passwordHash: 'stored-hash',
      });
      bcryptCompareMock.mockResolvedValueOnce(false);

      await expect(
        service.loginAdmin('admin@campusride.ci', 'bad-password'),
      ).rejects.toThrow(UnauthorizedException);
      expect(signAsyncMock).not.toHaveBeenCalled();
    });

    it('throws a generic UnauthorizedException when the account is not an admin', async () => {
      findUniqueMock.mockResolvedValueOnce({
        id: 'user-1',
        email: 'etudiant@campusride.ci',
        role: 'etudiant',
        passwordHash: 'stored-hash',
      });
      bcryptCompareMock.mockResolvedValueOnce(true);

      await expect(
        service.loginAdmin('etudiant@campusride.ci', 'good-password'),
      ).rejects.toThrow(UnauthorizedException);
      expect(signAsyncMock).not.toHaveBeenCalled();
    });
  });
});
