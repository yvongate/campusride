export function getDisplayName(
  nom: string | null,
  prenom: string | null,
  telephone: string | null,
): string {
  if (nom && prenom) return `${prenom} ${nom}`;
  if (nom) return nom;
  if (prenom) return prenom;
  return telephone ?? 'Utilisateur';
}
