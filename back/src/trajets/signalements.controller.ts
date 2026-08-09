import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TrajetsService } from './trajets.service';

@ApiTags('Signalements')
@ApiBearerAuth('access-token')
@Controller('admin/signalements')
export class SignalementsController {
  constructor(private readonly trajetsService: TrajetsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async listerSignalements() {
    return this.trajetsService.listerSignalements();
  }

  @Patch(':id/traiter')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async traiterSignalement(@Param('id') id: string) {
    return this.trajetsService.traiterSignalement(id);
  }
}
