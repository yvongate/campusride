/**
 * Le flux OTP ne collecte ni nom ni prenom -- ces champs restent null jusqu'a
 * un futur ecran d'edition de profil. En repli, le numero de telephone reste
 * un identifiant reel et utile, contrairement a un placeholder generique.
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
