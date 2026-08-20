import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Verifie a chaque requete authentifiee (pas seulement a la connexion) :
  // un token deja emis avant la desactivation doit lui aussi cesser de
  // fonctionner immediatement (voir UsersService.desactiverCompte).
  //
  // La suspension, elle, n'est PAS rejetee ici : elle est seulement remontee
  // dans request.user, et c'est JwtAuthGuard qui la refuse route par route.
  // Un rejet global rendrait le formulaire de contact inaccessible a ceux
  // qu'il concerne -- une sanction automatique sans aucun recours.
  async validate(payload: JwtPayload) {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: payload.sub },
      select: { actif: true, suspenduJusqua: true },
    });
    if (utilisateur && !utilisateur.actif) {
      throw new UnauthorizedException('Ton compte a été désactivé.');
    }
    return {
      userId: payload.sub,
      role: payload.role,
      suspenduJusqua: utilisateur?.suspenduJusqua ?? null,
    };
  }
}
