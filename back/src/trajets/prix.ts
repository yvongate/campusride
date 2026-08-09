// Cahier des charges §6.2 : la division n'est arrondie que si elle ne
// tombe pas deja sur un montant FCFA entier ("rond"). Exemple explicite du
// cahier des charges : 3500 / 4 passagers = 875 (deja entier) -> 875,
// jamais arrondi a 880. Un cas comme 3500 / 3 = 1166,66... n'est pas entier
// -> arrondi a la dizaine superieure (1170), pour que la somme percue par
// le conducteur reste toujours >= prixTotal.
export function computePrixParPersonne(
  prixTotal: number,
  nombrePassagers: number,
): number {
  const prixExact = prixTotal / nombrePassagers;
  if (Number.isInteger(prixExact)) {
    return prixExact;
  }
  return Math.ceil(prixExact / 10) * 10;
}
