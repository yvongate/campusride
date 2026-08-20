import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AUTORISE_SI_SUSPENDU_KEY } from '../decorators/autorise-si-suspendu.decorator';

interface RequeteAuthentifiee extends Request {
  user?: { userId: string; role: string; suspenduJusqua: Date | null };
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  // La verification de suspension vit ici plutot que dans un APP_GUARD global :
  // un garde global s'execute AVANT celui qui authentifie, il ne verrait donc
  // jamais request.user et laisserait tout passer. En heritant de JwtAuthGuard
  // on est certain de tourner juste apres le remplissage de request.user.
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authentifie = (await super.canActivate(context)) as boolean;
    if (!authentifie) {
      return false;
    }

    if (
      this.reflector.getAllAndOverride<boolean>(AUTORISE_SI_SUSPENDU_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<RequeteAuthentifiee>();
    if (user?.suspenduJusqua && user.suspenduJusqua > new Date()) {
      // 403 et non 401 : le token est valide, c'est le compte qui est bride.
      // L'intercepteur mobile deconnecte sur 401 -- renvoyer 401 ici ejecterait
      // l'utilisateur au lieu de l'amener a l'ecran de recours.
      throw new ForbiddenException({
        code: 'COMPTE_SUSPENDU',
        suspenduJusqua: user.suspenduJusqua.toISOString(),
        message: `Ton compte est suspendu jusqu'au ${user.suspenduJusqua.toLocaleDateString('fr-FR')} suite à une annulation tardive répétée.`,
      });
    }

    return true;
  }
}
