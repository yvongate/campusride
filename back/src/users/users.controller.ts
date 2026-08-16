import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import { extname } from 'path';
import type { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { conducteurFilesStorage } from './conducteur-files.storage';
import { CreateDemandeConducteurDto } from './dto/create-demande-conducteur.dto';
import { UpdateProfilDto } from './dto/update-profil.dto';
import { UsersService } from './users.service';

interface AuthenticatedRequest extends Request {
  user: { userId: string; role: string };
}

interface ConducteurUploadedFiles {
  selfie?: Express.Multer.File[];
  permis?: Express.Multer.File[];
  photoVehicule?: Express.Multer.File[];
}

const DOCUMENT_CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.findByIdAvecUniversite(
      req.user.userId,
    );
    const conducteurStatut = await this.usersService.getConducteurStatus(
      req.user.userId,
    );
    return {
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      telephone: user.telephone,
      note: user.note,
      nombreNotations: user.nombreNotations,
      universiteId: user.universiteId,
      universite: user.universite ? { id: user.universite.id, nom: user.universite.nom } : null,
      conducteurStatut,
    };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfilDto,
  ) {
    const user = await this.usersService.updateProfil(req.user.userId, dto);
    return { id: user.id, nom: user.nom, universiteId: user.universiteId };
  }

  @Post('me/conducteur')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'selfie', maxCount: 1 },
        { name: 'permis', maxCount: 1 },
        { name: 'photoVehicule', maxCount: 1 },
      ],
      { storage: conducteurFilesStorage },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        selfie: { type: 'string', format: 'binary' },
        permis: { type: 'string', format: 'binary' },
        matriculeVehicule: { type: 'string' },
        photoVehicule: { type: 'string', format: 'binary' },
        motBienvenue: { type: 'string' },
      },
    },
  })
  async devenirConducteur(
    @Req() req: AuthenticatedRequest,
    @UploadedFiles() files: ConducteurUploadedFiles,
    @Body() dto: CreateDemandeConducteurDto,
  ) {
    const selfie = files.selfie?.[0];
    const permis = files.permis?.[0];
    if (!selfie || !permis) {
      throw new BadRequestException('Le selfie et la photo du permis sont requis');
    }
    const photoVehicule = files.photoVehicule?.[0];

    return this.usersService.createDemandeConducteur(
      req.user.userId,
      {
        selfie: selfie.filename,
        photoPermis: permis.filename,
        photoVehicule: photoVehicule?.filename,
      },
      dto.matriculeVehicule,
      dto.motBienvenue,
    );
  }

  @Get('conducteurs/demandes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async listDemandesConducteur() {
    const demandes = await this.usersService.listDemandesConducteurEnAttente();
    return demandes.map((demande) => ({
      id: demande.id,
      nom: demande.utilisateur.nom,
      prenom: demande.utilisateur.prenom,
      telephone: demande.utilisateur.telephone,
      matriculeVehicule: demande.matriculeVehicule,
      statut: demande.statut,
      createdAt: demande.createdAt,
    }));
  }

  @Get('conducteurs/demandes/:id/documents/:type')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getDocumentConducteur(
    @Param('id') id: string,
    @Param('type') type: string,
  ) {
    const path = await this.usersService.getDocumentAbsolutePath(id, type);
    const contentType =
      DOCUMENT_CONTENT_TYPES[extname(path).toLowerCase()] ??
      'application/octet-stream';
    return new StreamableFile(createReadStream(path), { type: contentType });
  }

  @Patch('conducteurs/demandes/:id/valider')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async validerDemandeConducteur(@Param('id') id: string) {
    return this.usersService.validerDemandeConducteur(id);
  }

  @Patch('conducteurs/demandes/:id/refuser')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async refuserDemandeConducteur(@Param('id') id: string) {
    return this.usersService.refuserDemandeConducteur(id);
  }
}
