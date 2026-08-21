import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { join } from 'path';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CONDUCTEUR_UPLOADS_DIR } from './conducteur-files.storage';

export interface ConducteurFiles {
  selfie: string;
  photoPermis: string;
  photoVehicule?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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
    data: { nom?: string; universiteId?: string; estChauffeur?: boolean },
  ) {
    if (data.universiteId) {
      const universite = await this.prisma.universite.findUnique({
        where: { id: data.universiteId },
      });
      if (!universite) {
        throw new BadRequestException("L'université indiquée est introuvable.");
      }
    }

    const updateData: { nom?: string; universiteId?: string; role?: string } =
      {
        nom: data.nom,
        universiteId: data.universiteId,
      };

    // Ne s'applique qu'a un compte encore "etudiant" (jamais rattache a une
    // universite ni deja conducteur) -- ne retrograde jamais un compte deja
    // "les deux" ou "admin". Un compte "chauffeur" qui redeclare
    // estChauffeur reste simplement "chauffeur" (idempotent).
    if (data.estChauffeur) {
      const utilisateur = await this.prisma.utilisateur.findUniqueOrThrow({
        where: { id: userId },
        select: { role: true },
      });
      if (utilisateur.role === 'etudiant') {
        updateData.role = 'chauffeur';
      }
    }

    // Chemin inverse. "chauffeur" signifie "pas etudiant, donc aucune
    // universite de rattachement" : declarer une universite contredit ce
    // choix, on rectifie le role au lieu de garder un compte incoherent.
    // Sans ca, "je ne suis pas etudiant" etait un aller sans retour -- un
    // seul appui de trop enfermait le compte dans un accueil sans le moindre
    // trajet. Un chauffeur DEJA valide devient "les deux" et non "etudiant",
    // sinon il perdrait au passage son droit de publier.
    else if (data.universiteId) {
      const utilisateur = await this.prisma.utilisateur.findUniqueOrThrow({
        where: { id: userId },
        select: { role: true },
      });
      if (utilisateur.role === 'chauffeur') {
        const documentsValides = await this.prisma.documentsConducteur.findFirst(
          { where: { userId, statut: 'valide' }, select: { id: true } },
        );
        updateData.role = documentsValides ? 'les deux' : 'etudiant';
      }
    }

    return this.prisma.utilisateur.update({
      where: { id: userId },
      data: updateData,
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
        'Une demande de compte conducteur est déjà en attente.',
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
        'Type de document invalide (selfie ou permis attendu).',
      );
    }

    const demande = await this.prisma.documentsConducteur.findUnique({
      where: { id: demandeId },
    });
    if (!demande) {
      throw new NotFoundException('Cette demande de compte conducteur est introuvable.');
    }

    const filename = type === 'selfie' ? demande.selfie : demande.photoPermis;
    return join(CONDUCTEUR_UPLOADS_DIR, filename);
  }

  async validerDemandeConducteur(demandeId: string) {
    const demande = await this.prisma.documentsConducteur.findUnique({
      where: { id: demandeId },
    });
    if (!demande) {
      throw new NotFoundException('Cette demande de compte conducteur est introuvable.');
    }
    if (demande.statut !== 'en attente') {
      throw new ConflictException('Cette demande a déjà été traitée.');
    }

    // Un compte deja "chauffeur" (jamais etudiant, voir
    // UsersService.updateProfil) reste "chauffeur" une fois valide -- seul un
    // "etudiant" devient "les deux" (etudiant + conducteur combines).
    const utilisateur = await this.prisma.utilisateur.findUniqueOrThrow({
      where: { id: demande.userId },
      select: { role: true },
    });
    const nouveauRole = utilisateur.role === 'chauffeur' ? 'chauffeur' : 'les deux';

    const [updatedDemande] = await this.prisma.$transaction([
      this.prisma.documentsConducteur.update({
        where: { id: demandeId },
        data: { statut: 'valide' },
      }),
      this.prisma.utilisateur.update({
        where: { id: demande.userId },
        data: { role: nouveauRole },
      }),
    ]);

    // Sans cette notification, un conducteur valide ne l'apprenait qu'en
    // rouvrant l'app par hasard -- alors que c'est precisement le moment ou
    // il peut enfin publier un trajet.
    await this.notifications.envoyer(
      [demande.userId],
      'Compte conducteur validé',
      'Ta demande a été acceptée : tu peux maintenant publier des trajets et accepter des demandes.',
      { type: 'compte' },
    );

    return updatedDemande;
  }

  async refuserDemandeConducteur(demandeId: string) {
    const demande = await this.prisma.documentsConducteur.findUnique({
      where: { id: demandeId },
    });
    if (!demande) {
      throw new NotFoundException('Cette demande de compte conducteur est introuvable.');
    }
    if (demande.statut !== 'en attente') {
      throw new ConflictException('Cette demande a déjà été traitée.');
    }

    const refusee = await this.prisma.documentsConducteur.update({
      where: { id: demandeId },
      data: { statut: 'refuse' },
    });

    await this.notifications.envoyer(
      [demande.userId],
      'Demande conducteur refusée',
      "Ta demande n'a pas été acceptée. Tu peux en soumettre une nouvelle avec des documents plus lisibles.",
      { type: 'compte' },
    );

    return refusee;
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

  private async changerStatutCompte(
    userId: string,
    data: { actif: boolean; suspenduJusqua?: null },
  ) {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
    });
    if (!utilisateur) {
      throw new NotFoundException('Ce compte est introuvable.');
    }
    if (utilisateur.role === 'admin') {
      throw new BadRequestException(
        'Les comptes administrateurs ne sont pas gérés par cette action.',
      );
    }

    return this.prisma.utilisateur.update({
      where: { id: userId },
      data,
    });
  }

  async desactiverCompte(userId: string) {
    return this.changerStatutCompte(userId, { actif: false });
  }

  // Leve aussi une suspension pour annulation tardive repetee (voir
  // TrajetsService.annulerReservation) -- meme bouton, ca donne a l'admin un
  // recours en cas de motif legitime, sans ecran dedie a la suspension.
  async reactiverCompte(userId: string) {
    return this.changerStatutCompte(userId, { actif: true, suspenduJusqua: null });
  }
}
