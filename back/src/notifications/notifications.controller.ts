import { Body, Controller, Delete, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EnregistrerAppareilDto } from './dto/enregistrer-appareil.dto';
import { SupprimerAppareilDto } from './dto/supprimer-appareil.dto';
import { NotificationsService } from './notifications.service';

interface AuthenticatedRequest extends Request {
  user: { userId: string; role: string };
}

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('notifications/appareils')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async enregistrer(
    @Req() req: AuthenticatedRequest,
    @Body() dto: EnregistrerAppareilDto,
  ) {
    await this.notificationsService.enregistrerAppareil(
      req.user.userId,
      dto.token,
      dto.plateforme,
    );
  }

  // Appele a la deconnexion. Volontairement authentifie mais sans
  // verification que le token appartient a l'appelant : c'est l'appareil
  // courant qui se desinscrit lui-meme, et le pire cas (supprimer un token
  // qu'on ne possede pas) ne fait que priver cet appareil de notifications
  // jusqu'a sa prochaine ouverture, sans fuite d'information.
  @Delete()
  @UseGuards(JwtAuthGuard)
  async supprimer(@Body() dto: SupprimerAppareilDto) {
    await this.notificationsService.supprimerAppareil(dto.token);
  }
}
