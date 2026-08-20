// Meme regle que back/src/common/utils/fenetre-reservation.ts (un trajet ou
// une demande ne peut etre planifie que pour aujourd'hui ou demain) -- sert
// ici a borner le picker de date natif (PublierTrajetScreen/
// CreerDemandeScreen) pour empecher physiquement de choisir plus loin, au
// lieu de laisser choisir puis rejeter a la soumission. Le backend reste la
// source de verite (voir verifierFenetreReservation).
// Meme delai minimum que le backend : une heure de depart trop proche est
// refusee (la demande naitrait dans la zone d'expiration et serait supprimee
// dans la minute). Borner le picker evite d'avoir a expliquer le rejet apres
// coup.
const DELAI_MINIMUM_MS = 75 * 60 * 1000;

export function bornesFenetreReservation(): { minimumDate: Date; maximumDate: Date } {
  const maximumDate = new Date();
  maximumDate.setDate(maximumDate.getDate() + 1);
  maximumDate.setHours(23, 59, 59, 999);
  return {
    minimumDate: new Date(Date.now() + DELAI_MINIMUM_MS),
    maximumDate,
  };
}

// Valeur de depart des formulaires : la 1re heure valide, arrondie au quart
// d'heure suivant. Sans ca, le champ s'ouvrait sur "maintenant", une valeur
// systematiquement refusee a la soumission.
export function premiereHeureValide(): Date {
  const date = new Date(Date.now() + DELAI_MINIMUM_MS);
  date.setSeconds(0, 0);
  const reste = date.getMinutes() % 15;
  if (reste !== 0) {
    date.setMinutes(date.getMinutes() + (15 - reste));
  }
  return date;
}
