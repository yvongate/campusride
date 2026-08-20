import { PrismaService } from '../../prisma/prisma.service';

// 1re annulation tardive toleree (§8.2) -- a la 2e, le compte est suspendu
// (bannissement reel, pas une simple baisse de note), puis le compteur repart
// a zero : un nouveau cycle "2 essais" recommence apres chaque suspension,
// plutot qu'un compteur a vie qui sanctionnerait automatiquement toutes les
// annulations suivantes.
const ANNULATIONS_TARDIVES_AVANT_SUSPENSION = 2;
const SUSPENSION_DUREE_MS = 21 * 24 * 60 * 60 * 1000;

export interface SanctionAnnulationTardive {
  // A ecrire sur l'Utilisateur. Volontairement renvoye plutot qu'ecrit ici :
  // l'appelant doit pouvoir l'inclure dans SA transaction, aux cotes de
  // l'annulation qui la declenche (les deux doivent etre atomiques).
  data: { annulationsTardives: number; suspenduJusqua?: Date };
  // Renseigne uniquement quand la suspension vient d'etre declenchee --
  // permet a l'appelant de notifier et de renvoyer l'info au mobile, qui
  // explique avant de deconnecter (sinon l'utilisateur se prend un 401 muet).
  suspenduJusqua: Date | null;
}

// Partage entre l'annulation tardive d'une reservation (passager) et
// l'annulation d'une demande ayant deja des participants (createur) : les
// deux cassent l'engagement d'autres personnes, elles doivent donc compter
// pareil et alimenter le meme compteur.
export async function calculerSanctionAnnulationTardive(
  prisma: PrismaService,
  userId: string,
): Promise<SanctionAnnulationTardive> {
  const utilisateur = await prisma.utilisateur.findUniqueOrThrow({
    where: { id: userId },
    select: { annulationsTardives: true },
  });

  const suspendu =
    utilisateur.annulationsTardives + 1 >= ANNULATIONS_TARDIVES_AVANT_SUSPENSION;
  const suspenduJusqua = suspendu
    ? new Date(Date.now() + SUSPENSION_DUREE_MS)
    : null;

  return {
    data: suspenduJusqua
      ? { annulationsTardives: 0, suspenduJusqua }
      : { annulationsTardives: utilisateur.annulationsTardives + 1 },
    suspenduJusqua,
  };
}
