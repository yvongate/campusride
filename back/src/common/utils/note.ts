// "note" (le champ public, toujours affiche) est toujours derive de ces deux
// composantes -- jamais ecrit directement ailleurs. Sans ce point de passage
// unique, un recalcul de moyenne (NotationService) et une penalite
// (TrajetsService, absence/annulation tardive) s'ecrasent mutuellement
// puisque les deux ecrivaient jusqu'ici sur le meme champ "note" en repartant
// de zero.
export const MIN_NOTE = 1;

export function computeNote(
  noteBrute: number | null,
  penaliteCumulee: number,
): number | null {
  if (noteBrute === null) return null;
  return Math.max(MIN_NOTE, noteBrute - penaliteCumulee);
}
