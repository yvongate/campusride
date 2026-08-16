import { PrismaService } from '../../prisma/prisma.service';

// 425 des 432 universites seedees n'ont qu'une position aleatoire dans leur
// commune (aucune adresse reelle disponible, voir prisma/seed.ts) -- un rayon
// en kilometres calcule sur ces coordonnees donnerait une precision
// illusoire. La commune (donnee reelle, connue avec certitude pour chaque
// etablissement) est le seul niveau de granularite fiable pour rapprocher des
// etudiants d'ecoles voisines mais distinctes, plutot que de filtrer en
// egalite stricte sur universiteId et fragmenter le bassin en autant de
// groupes isoles qu'il y a d'universites.
export async function resolveUniversitesProches(
  prisma: PrismaService,
  universiteId: string,
): Promise<string[]> {
  const universite = await prisma.universite.findUnique({
    where: { id: universiteId },
  });
  if (!universite) {
    return [universiteId];
  }

  const proches = await prisma.universite.findMany({
    where: { commune: universite.commune },
    select: { id: true },
  });
  return proches.map((u) => u.id);
}
