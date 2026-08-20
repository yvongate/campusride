import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AutoriseSiSuspendu } from '../common/decorators/autorise-si-suspendu.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreerMessageSupportDto } from './dto/creer-message-support.dto';
import { RepondreMessageSupportDto } from './dto/repondre-message-support.dto';
import { SupportService } from './support.service';

interface AuthenticatedRequest extends Request {
  user: { userId: string; role: string };
}

@ApiTags('Support')
@ApiBearerAuth('access-token')
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  // @AutoriseSiSuspendu : c'est precisement le compte suspendu qui a besoin
  // d'ecrire ici. Sans ce decorateur, la seule voie de recours contre une
  // sanction automatique serait fermee a ceux qu'elle frappe.
  @Post()
  @UseGuards(JwtAuthGuard)
  @AutoriseSiSuspendu()
  creer(@Req() req: AuthenticatedRequest, @Body() dto: CreerMessageSupportDto) {
    return this.supportService.creerMessage(req.user.userId, dto.contenu);
  }

  @Get('mes-messages')
  @UseGuards(JwtAuthGuard)
  @AutoriseSiSuspendu()
  mesMessages(@Req() req: AuthenticatedRequest) {
    return this.supportService.listerMesMessages(req.user.userId);
  }

}

// Controleur distinct pour respecter la convention du back-office : toutes
// les routes consommees par front_web vivent sous /admin/*.
@ApiTags('Support')
@ApiBearerAuth('access-token')
@Controller('admin/support')
export class SupportAdminController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  lister() {
    return this.supportService.lister();
  }

  @Patch(':id/repondre')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  repondre(@Param('id') id: string, @Body() dto: RepondreMessageSupportDto) {
    return this.supportService.repondre(id, dto.reponse);
  }
}
