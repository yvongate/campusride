/**
 * Le flux OTP ne collecte que le nom (CompleterProfilScreen, premiere
 * connexion) -- prenom reste toujours null pour l'instant. En repli, le
 * numero de telephone reste un identifiant reel et utile, contrairement a
 * un placeholder generique.
 */
export function getDisplayName(
  nom: string | null,
  prenom: string | null,
  telephone: string,
): string {
  if (nom && prenom) return `${prenom} ${nom}`;
  if (nom) return nom;
  if (prenom) return prenom;
  return telephone;
}
