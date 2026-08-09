import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StatistiquesService } from './statistiques.service';

@ApiTags('Statistiques')
@ApiBearerAuth('access-token')
@Controller('admin/statistiques')
export class StatistiquesController {
  constructor(private readonly statistiquesService: StatistiquesService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async obtenirStatistiques() {
    return this.statistiquesService.obtenirStatistiques();
  }
}
