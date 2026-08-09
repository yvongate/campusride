import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommuneDto } from './dto/create-commune.dto';
import { CreatePointInteretDto } from './dto/create-point-interet.dto';
import { CreateQuartierDto } from './dto/create-quartier.dto';
import { CreateUniversiteDto } from './dto/create-universite.dto';
import { UpdateUniversiteDto } from './dto/update-universite.dto';

@Injectable()
export class ReferentielService {
  constructor(private readonly prisma: PrismaService) {}

  async createUniversite(dto: CreateUniversiteDto) {
    return this.prisma.universite.create({ data: dto });
  }

  async listUniversites() {
    return this.prisma.universite.findMany({ orderBy: { nom: 'asc' } });
  }

  async updateUniversite(id: string, dto: UpdateUniversiteDto) {
    const universite = await this.prisma.universite.findUnique({
      where: { id },
    });
    if (!universite) {
      throw new NotFoundException('Universite introuvable');
    }

    return this.prisma.universite.update({ where: { id }, data: dto });
  }

  async createCommune(dto: CreateCommuneDto) {
    return this.prisma.commune.create({ data: dto });
  }

  async listCommunes() {
    return this.prisma.commune.findMany({ orderBy: { nom: 'asc' } });
  }

  async createQuartier(dto: CreateQuartierDto) {
    const commune = await this.prisma.commune.findUnique({
      where: { id: dto.communeId },
    });
    if (!commune) {
      throw new BadRequestException('La commune associee est introuvable');
    }

    return this.prisma.quartier.create({ data: dto });
  }

  async listQuartiers(communeId?: string) {
    return this.prisma.quartier.findMany({
      where: communeId ? { communeId } : undefined,
      include: { commune: true },
      orderBy: { nom: 'asc' },
    });
  }

  async createPointInteret(dto: CreatePointInteretDto) {
    const quartier = await this.prisma.quartier.findUnique({
      where: { id: dto.quartierId },
    });
    if (!quartier) {
      throw new BadRequestException('Le quartier associe est introuvable');
    }

    return this.prisma.pointInteret.create({ data: dto });
  }

  async listPointsInteret(quartierId?: string) {
    return this.prisma.pointInteret.findMany({
      where: quartierId ? { quartierId } : undefined,
      include: { quartier: { include: { commune: true } } },
      orderBy: { nom: 'asc' },
    });
  }
}
