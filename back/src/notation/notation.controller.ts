import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateNotationDto } from './dto/create-notation.dto';
import { NotationService } from './notation.service';

interface AuthenticatedRequest extends Request {
  user: { userId: string; role: string };
}

@ApiTags('Notation')
@ApiBearerAuth('access-token')
@Controller('trajets/:trajetId/notations')
export class NotationController {
  constructor(private readonly notationService: NotationService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async noterParticipant(
    @Req() req: AuthenticatedRequest,
    @Param('trajetId') trajetId: string,
    @Body() dto: CreateNotationDto,
  ) {
    return this.notationService.noterParticipant(
      req.user.userId,
      trajetId,
      dto,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async listerNotationsTrajet(
    @Req() req: AuthenticatedRequest,
    @Param('trajetId') trajetId: string,
  ) {
    return this.notationService.listerNotationsTrajet(
      req.user.userId,
      trajetId,
    );
  }
}

@ApiTags('Notation')
@ApiBearerAuth('access-token')
@Controller('notations')
export class NotationsGlobalController {
  constructor(private readonly notationService: NotationService) {}

  @Get('en-attente')
  @UseGuards(JwtAuthGuard)
  async listerEnAttente(@Req() req: AuthenticatedRequest) {
    return this.notationService.listerNotationsEnAttente(req.user.userId);
  }
}

@ApiTags('Notation')
@ApiBearerAuth('access-token')
@Controller('users/:userId/notations')
export class UserAvisController {
  constructor(private readonly notationService: NotationService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async listerAvis(@Param('userId') userId: string) {
    return this.notationService.listerAvisUtilisateur(userId);
  }
}
