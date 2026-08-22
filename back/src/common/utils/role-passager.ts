import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Un compte "chauffeur" est un conducteur NON etudiant : il n'a aucune
// universite de rattachement, et les trajets etudiants ne le concernent pas.
// L'application ne lui propose deja rien de tout ca, mais les routes
// correspondantes restaient ouvertes -- seules publierTrajet et
// accepterDemande verifiaient le role. On ferme donc le cote passager, pour
// que le modele soit reellement tenu par le serveur et pas seulement par
// l'interface.
//
// Le message renvoie vers le chemin de sortie reel : declarer une universite
// fait repasser le compte en "etudiant" (ou "les deux" s'il est deja valide),
// voir UsersService.updateProfil.
export async function verifierPeutEtrePassager(
  prisma: PrismaService,
  userId: string,
): Promise<void> {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (utilisateur?.role === 'chauffeur') {
    throw new ForbiddenException(
      "Ton compte est un compte conducteur, il ne peut pas rejoindre un trajet en tant que passager. Si tu es aussi étudiant, choisis ton université depuis « Mes informations ».",
    );
  }
}
