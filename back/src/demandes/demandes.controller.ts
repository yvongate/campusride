import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateDemandeDto } from './dto/create-demande.dto';
import { JoinDemandeDto } from './dto/join-demande.dto';
import { ListDemandesDisponiblesQueryDto } from './dto/list-demandes-disponibles-query.dto';
import { ListDemandesQueryDto } from './dto/list-demandes-query.dto';
import { DemandesService } from './demandes.service';

interface AuthenticatedRequest extends Request {
  user: { userId: string; role: string };
}

@ApiTags('Demandes')
@ApiBearerAuth('access-token')
@Controller('demandes')
export class DemandesController {
  constructor(private readonly demandesService: DemandesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async creerDemande(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateDemandeDto,
  ) {
    return this.demandesService.creerDemande(req.user.userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async listerDemandes(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListDemandesQueryDto,
  ) {
    return this.demandesService.listerDemandes(
      query.universiteId,
      query.communeId,
      req.user.userId,
    );
  }

  // Doit rester declaree avant GET(':id') -- sinon NestJS route
  // /demandes/mine vers getDemandeDetail avec id: 'mine' (meme piege que
  // TrajetsController, voir Story 3.4 Dev Notes).
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  async listerMesDemandes(@Req() req: AuthenticatedRequest) {
    return this.demandesService.listerMesDemandes(req.user.userId);
  }

  @Post(':id/participations')
  @UseGuards(JwtAuthGuard)
  async rejoindreDemande(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: JoinDemandeDto,
  ) {
    return this.demandesService.rejoindreDemande(req.user.userId, id, dto);
  }

  @Get('disponibles')
  @UseGuards(JwtAuthGuard)
  async listerDemandesDisponibles(
    @Query() query: ListDemandesDisponiblesQueryDto,
  ) {
    return this.demandesService.listerDemandesDisponibles(
      query.communeId,
      query.universiteId,
    );
  }

  @Post(':id/annuler')
  @UseGuards(JwtAuthGuard)
  async annulerDemande(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.demandesService.annulerDemande(req.user.userId, id);
  }

  @Post(':id/quitter')
  @UseGuards(JwtAuthGuard)
  async quitterDemande(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.demandesService.quitterDemande(req.user.userId, id);
  }

  @Post(':id/accepter')
  @UseGuards(JwtAuthGuard)
  async accepterDemande(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.demandesService.accepterDemande(req.user.userId, id);
  }

  // Doit rester declaree apres GET('disponibles') -- sinon NestJS route
  // /demandes/disponibles vers getDemandeDetail avec id: 'disponibles'
  // (meme piege que TrajetsController, voir Story 3.4 Dev Notes).
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getDemandeDetail(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.demandesService.getDemandeDetail(req.user.userId, id);
  }
}
