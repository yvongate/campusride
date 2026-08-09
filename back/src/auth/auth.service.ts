import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcryptjs from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

interface PendingOtp {
  code: string;
  expiresAt: number;
}

export interface VerifyOtpResult {
  accessToken: string;
  user: { id: string; telephone: string; role: string };
}

export interface LoginAdminResult {
  accessToken: string;
  user: { id: string; email: string; role: string };
}

const OTP_TTL_MS = 5 * 60 * 1000;

// Hash factice a cout constant : compare toujours contre un hash, meme si
// aucun utilisateur n'est trouve, pour que le temps de reponse ne revele
// jamais si l'email existe (voir Story 1.6, Dev Notes).
const DUMMY_PASSWORD_HASH = bcryptjs.hashSync(
  'dummy-password-for-timing-safety',
  12,
);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly otpStore = new Map<string, PendingOtp>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  // Aucun fournisseur SMS branche (Twilio retire du projet, voir historique) --
  // le code est renvoye directement dans la reponse HTTP pour que le front
  // l'affiche/le pre-remplisse, plutot que d'etre livre par SMS reel. Meme
  // generation/stockage/expiration qu'avant, seule la livraison change.
  requestOtp(phone: string): { code: string } {
    const code = this.generateCode();
    this.otpStore.set(phone, { code, expiresAt: Date.now() + OTP_TTL_MS });
    this.logger.log(`OTP genere pour ${phone} (pas d'envoi SMS reel)`);
    return { code };
  }

  async verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
    const pending = this.otpStore.get(phone);

    if (!pending || Date.now() > pending.expiresAt) {
      this.otpStore.delete(phone);
      throw new UnauthorizedException(
        'Code expire ou introuvable, demandez un nouveau code',
      );
    }

    if (pending.code !== code) {
      throw new UnauthorizedException('Code incorrect');
    }

    this.otpStore.delete(phone);

    const user = await this.prisma.utilisateur.upsert({
      where: { telephone: phone },
      update: {},
      create: { telephone: phone, role: 'etudiant' },
    });

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
    });

    return {
      accessToken,
      user: { id: user.id, telephone: phone, role: user.role },
    };
  }

  async loginAdmin(email: string, password: string): Promise<LoginAdminResult> {
    const user = await this.prisma.utilisateur.findUnique({
      where: { email },
    });

    const passwordMatches = await bcryptjs.compare(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (
      !user ||
      !user.passwordHash ||
      !passwordMatches ||
      user.role !== 'admin'
    ) {
      throw new UnauthorizedException('Identifiants incorrects');
    }

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
    });

    return {
      accessToken,
      user: { id: user.id, email, role: user.role },
    };
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
