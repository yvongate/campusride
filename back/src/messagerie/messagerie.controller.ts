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
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagerieService } from './messagerie.service';

interface AuthenticatedRequest extends Request {
  user: { userId: string; role: string };
}

@ApiTags('Messagerie')
@ApiBearerAuth('access-token')
@Controller('trajets/:trajetId/messages')
export class MessagerieController {
  constructor(private readonly messagerieService: MessagerieService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async envoyerMessage(
    @Req() req: AuthenticatedRequest,
    @Param('trajetId') trajetId: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messagerieService.envoyerMessage(
      req.user.userId,
      trajetId,
      dto,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async listerMessages(
    @Req() req: AuthenticatedRequest,
    @Param('trajetId') trajetId: string,
  ) {
    return this.messagerieService.listerMessages(req.user.userId, trajetId);
  }
}
