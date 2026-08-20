import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import { extname } from 'path';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateTrajetDto } from './dto/create-trajet.dto';
import { ListTrajetsQueryDto } from './dto/list-trajets-query.dto';
import { TrajetsService } from './trajets.service';

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

interface AuthenticatedRequest extends Request {
  user: { userId: string; role: string };
}

@ApiTags('Trajets')
@ApiBearerAuth('access-token')
@Controller('trajets')
export class TrajetsController {
  constructor(private readonly trajetsService: TrajetsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async publierTrajet(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateTrajetDto,
  ) {
    return this.trajetsService.publierTrajet(req.user.userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async listerTrajets(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListTrajetsQueryDto,
  ) {
    return this.trajetsService.listerTrajets(query, req.user.userId);
  }

  // Doit rester declaree avant GET(':id') -- sinon NestJS route /trajets/mine
  // vers getTrajetDetail avec id: 'mine' (voir Story 3.4, Dev Notes).
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  async listerMesTrajets(@Req() req: AuthenticatedRequest) {
    return this.trajetsService.listerMesTrajets(req.user.userId);
  }

  // Doit rester declaree avant GET(':id') pour la meme raison que GET('mine')
  // ci-dessus (Story 3.4).
  @Get('mes-reservations')
  @UseGuards(JwtAuthGuard)
  async listerMesReservations(@Req() req: AuthenticatedRequest) {
    return this.trajetsService.listerMesReservations(req.user.userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getTrajetDetail(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.trajetsService.getTrajetDetail(id, req.user.userId);
  }

  @Get(':id/rencontre')
  @UseGuards(JwtAuthGuard)
  async getRencontre(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.trajetsService.getRencontre(req.user.userId, id);
  }

  @Get(':id/rencontre/photo')
  @UseGuards(JwtAuthGuard)
  async getRencontrePhotoVehicule(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const path = await this.trajetsService.getRencontrePhotoVehiculePath(
      req.user.userId,
      id,
    );
    const contentType =
      IMAGE_CONTENT_TYPES[extname(path).toLowerCase()] ??
      'application/octet-stream';
    return new StreamableFile(createReadStream(path), { type: contentType });
  }

  @Post(':id/reservations')
  @UseGuards(JwtAuthGuard)
  async reserverTrajet(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.trajetsService.reserverTrajet(req.user.userId, id);
  }

  @Patch(':id/demarrer')
  @UseGuards(JwtAuthGuard)
  async demarrerTrajet(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.trajetsService.demarrerTrajet(req.user.userId, id);
  }

  @Patch(':id/terminer')
  @UseGuards(JwtAuthGuard)
  async terminerTrajet(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.trajetsService.terminerTrajet(req.user.userId, id);
  }

  @Patch(':id/annuler')
  @UseGuards(JwtAuthGuard)
  async annulerTrajet(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.trajetsService.annulerTrajet(req.user.userId, id);
  }

  @Patch(':id/reservations/annuler')
  @UseGuards(JwtAuthGuard)
  async annulerReservation(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.trajetsService.annulerReservation(req.user.userId, id);
  }

  @Patch(':id/signaler-absence')
  @UseGuards(JwtAuthGuard)
  async signalerNoShow(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.trajetsService.signalerNoShow(req.user.userId, id);
  }

  @Patch(':id/passagers/:passagerId/signaler-absence')
  @UseGuards(JwtAuthGuard)
  async signalerPassagerAbsent(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('passagerId') passagerId: string,
  ) {
    return this.trajetsService.signalerPassagerAbsent(
      req.user.userId,
      id,
      passagerId,
    );
  }
}
