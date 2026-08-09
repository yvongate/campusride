import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateCommuneDto } from './dto/create-commune.dto';
import { CreatePointInteretDto } from './dto/create-point-interet.dto';
import { CreateQuartierDto } from './dto/create-quartier.dto';
import { CreateUniversiteDto } from './dto/create-universite.dto';
import { UpdateUniversiteDto } from './dto/update-universite.dto';
import { ReferentielService } from './referentiel.service';

@ApiTags('Referentiel')
@ApiBearerAuth('access-token')
@Controller('referentiel')
export class ReferentielController {
  constructor(private readonly referentielService: ReferentielService) {}

  @Get('universites')
  @UseGuards(JwtAuthGuard)
  async listUniversites() {
    return this.referentielService.listUniversites();
  }

  @Post('universites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async createUniversite(@Body() dto: CreateUniversiteDto) {
    return this.referentielService.createUniversite(dto);
  }

  @Patch('universites/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateUniversite(
    @Param('id') id: string,
    @Body() dto: UpdateUniversiteDto,
  ) {
    return this.referentielService.updateUniversite(id, dto);
  }

  @Get('communes')
  @UseGuards(JwtAuthGuard)
  async listCommunes() {
    return this.referentielService.listCommunes();
  }

  @Post('communes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async createCommune(@Body() dto: CreateCommuneDto) {
    return this.referentielService.createCommune(dto);
  }

  @Get('quartiers')
  @UseGuards(JwtAuthGuard)
  async listQuartiers(@Query('communeId') communeId?: string) {
    return this.referentielService.listQuartiers(communeId);
  }

  @Post('quartiers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async createQuartier(@Body() dto: CreateQuartierDto) {
    return this.referentielService.createQuartier(dto);
  }

  @Get('points-interet')
  @UseGuards(JwtAuthGuard)
  async listPointsInteret(@Query('quartierId') quartierId?: string) {
    return this.referentielService.listPointsInteret(quartierId);
  }

  @Post('points-interet')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async createPointInteret(@Body() dto: CreatePointInteretDto) {
    return this.referentielService.createPointInteret(dto);
  }
}
