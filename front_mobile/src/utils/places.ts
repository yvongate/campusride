// placesRecherchees = taille totale du groupe (createur inclus, voir
// backend DemandesService) -- ce helper convertit ça en un texte clair
// pour l'utilisateur ("2 places restantes"), utilise sur Accueil, Mes
// trajets et Point de regroupement.
export function formatPlacesRestantes(
  placesRecherchees: number,
  placesConfirmees: number,
): string {
  const restantes = placesRecherchees - placesConfirmees;
  if (restantes <= 0) return 'Groupe complet';
  return `${restantes} place${restantes > 1 ? 's' : ''} restante${restantes > 1 ? 's' : ''}`;
}
