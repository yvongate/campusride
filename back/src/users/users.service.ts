import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CONDUCTEUR_UPLOADS_DIR } from './conducteur-files.storage';

export interface ConducteurFiles {
  selfie: string;
  photoPermis: string;
  photoVehicule?: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.utilisateur.findUniqueOrThrow({ where: { id } });
  }

  async findByIdAvecUniversite(id: string) {
    return this.prisma.utilisateur.findUniqueOrThrow({
      where: { id },
      include: { universite: true },
    });
  }

  async updateProfil(
    userId: string,
    data: { nom?: string; universiteId?: string },
  ) {
    if (data.universiteId) {
      const universite = await this.prisma.universite.findUnique({
        where: { id: data.universiteId },
      });
      if (!universite) {
        throw new BadRequestException("L'universite indiquee est introuvable");
      }
    }

    return this.prisma.utilisateur.update({
      where: { id: userId },
      data,
    });
  }

  async getConducteurStatus(userId: string): Promise<string | null> {
    const latest = await this.prisma.documentsConducteur.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return latest?.statut ?? null;
  }

  async createDemandeConducteur(
    userId: string,
    files: ConducteurFiles,
    matriculeVehicule: string,
    motBienvenue?: string,
  ) {
    const pending = await this.prisma.documentsConducteur.findFirst({
      where: { userId, statut: 'en attente' },
    });
    if (pending) {
      throw new ConflictException(
        'Une demande de compte conducteur est deja en attente',
      );
    }

    return this.prisma.documentsConducteur.create({
      data: {
        userId,
        selfie: files.selfie,
        photoPermis: files.photoPermis,
        matriculeVehicule,
        photoVehicule: files.photoVehicule,
        motBienvenue,
      },
    });
  }

  async listDemandesConducteurEnAttente() {
    return this.prisma.documentsConducteur.findMany({
      where: { statut: 'en attente' },
      include: { utilisateur: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getDocumentAbsolutePath(
    demandeId: string,
    type: string,
  ): Promise<string> {
    if (type !== 'selfie' && type !== 'permis') {
      throw new BadRequestException(
        'Type de document invalide (selfie ou permis attendu)',
      );
    }

    const demande = await this.prisma.documentsConducteur.findUnique({
      where: { id: demandeId },
    });
    if (!demande) {
      throw new NotFoundException('Demande de compte conducteur introuvable');
    }

    const filename = type === 'selfie' ? demande.selfie : demande.photoPermis;
    return join(CONDUCTEUR_UPLOADS_DIR, filename);
  }

  async validerDemandeConducteur(demandeId: string) {
    const demande = await this.prisma.documentsConducteur.findUnique({
      where: { id: demandeId },
    });
    if (!demande) {
      throw new NotFoundException('Demande de compte conducteur introuvable');
    }
    if (demande.statut !== 'en attente') {
      throw new ConflictException('Cette demande a deja ete traitee');
    }

    const [updatedDemande] = await this.prisma.$transaction([
      this.prisma.documentsConducteur.update({
        where: { id: demandeId },
        data: { statut: 'valide' },
      }),
      this.prisma.utilisateur.update({
        where: { id: demande.userId },
        data: { role: 'les deux' },
      }),
    ]);

    return updatedDemande;
  }

  async refuserDemandeConducteur(demandeId: string) {
    const demande = await this.prisma.documentsConducteur.findUnique({
      where: { id: demandeId },
    });
    if (!demande) {
      throw new NotFoundException('Demande de compte conducteur introuvable');
    }
    if (demande.statut !== 'en attente') {
      throw new ConflictException('Cette demande a deja ete traitee');
    }

    return this.prisma.documentsConducteur.update({
      where: { id: demandeId },
      data: { statut: 'refuse' },
    });
  }

  async listerComptes() {
    return this.prisma.utilisateur.findMany({
      where: { role: { not: 'admin' } },
      select: {
        id: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        note: true,
        actif: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async changerStatutCompte(userId: string, actif: boolean) {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
    });
    if (!utilisateur) {
      throw new NotFoundException('Compte introuvable');
    }
    if (utilisateur.role === 'admin') {
      throw new BadRequestException(
        'Les comptes administrateurs ne sont pas geres par cet endpoint',
      );
    }

    return this.prisma.utilisateur.update({
      where: { id: userId },
      data: { actif },
    });
  }

  async desactiverCompte(userId: string) {
    return this.changerStatutCompte(userId, false);
  }

  async reactiverCompte(userId: string) {
    return this.changerStatutCompte(userId, true);
  }
}
