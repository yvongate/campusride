import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CONDUCTEUR_UPLOADS_DIR } from './conducteur-files.storage';
import { IDENTITE_UPLOADS_DIR } from './identite-files.storage';

export interface ConducteurFiles {
  photoPermis: string;
  photoVehicule?: string;
}

export interface IdentiteFiles {
  cni: string;
  selfie: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.utilisateur.findUniqueOrThrow({ where: { id } });
  }

  async getConducteurStatus(userId: string): Promise<string | null> {
    const latest = await this.prisma.documentsConducteur.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return latest?.statut ?? null;
  }

  async getVerificationStatus(userId: string): Promise<string | null> {
    const latest = await this.prisma.verificationIdentite.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return latest?.statut ?? null;
  }

  async createVerificationIdentite(userId: string, files: IdentiteFiles) {
    const pending = await this.prisma.verificationIdentite.findFirst({
      where: { userId, statut: 'en attente' },
    });
    if (pending) {
      throw new ConflictException(
        'Une verification d’identite est deja en attente',
      );
    }

    return this.prisma.verificationIdentite.create({
      data: { userId, cni: files.cni, selfie: files.selfie },
    });
  }

  async listVerificationsEnAttente() {
    return this.prisma.verificationIdentite.findMany({
      where: { statut: 'en attente' },
      include: { utilisateur: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getVerificationDocumentAbsolutePath(
    verificationId: string,
    type: string,
  ): Promise<string> {
    if (type !== 'cni' && type !== 'selfie') {
      throw new BadRequestException(
        'Type de document invalide (cni ou selfie attendu)',
      );
    }

    const verification = await this.prisma.verificationIdentite.findUnique({
      where: { id: verificationId },
    });
    if (!verification) {
      throw new NotFoundException('Verification introuvable');
    }

    const filename = type === 'cni' ? verification.cni : verification.selfie;
    return join(IDENTITE_UPLOADS_DIR, filename);
  }

  async validerVerificationIdentite(verificationId: string) {
    const verification = await this.prisma.verificationIdentite.findUnique({
      where: { id: verificationId },
    });
    if (!verification) {
      throw new NotFoundException('Verification introuvable');
    }
    if (verification.statut !== 'en attente') {
      throw new ConflictException('Cette verification a deja ete traitee');
    }

    return this.prisma.verificationIdentite.update({
      where: { id: verificationId },
      data: { statut: 'valide' },
    });
  }

  async refuserVerificationIdentite(verificationId: string) {
    const verification = await this.prisma.verificationIdentite.findUnique({
      where: { id: verificationId },
    });
    if (!verification) {
      throw new NotFoundException('Verification introuvable');
    }
    if (verification.statut !== 'en attente') {
      throw new ConflictException('Cette verification a deja ete traitee');
    }

    return this.prisma.verificationIdentite.update({
      where: { id: verificationId },
      data: { statut: 'refuse' },
    });
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

    // Le selfie provient de la VerificationIdentite deja validee -- pas
    // redemande ici (voir modele VerificationIdentite, schema.prisma).
    const verificationValidee = await this.prisma.verificationIdentite.findFirst({
      where: { userId, statut: 'valide' },
      orderBy: { createdAt: 'desc' },
    });
    if (!verificationValidee) {
      throw new ConflictException(
        'Complete d’abord ta verification d’identite (CNI + selfie) avant de devenir conducteur',
      );
    }

    return this.prisma.documentsConducteur.create({
      data: {
        userId,
        selfie: verificationValidee.selfie,
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
