import { BadRequestException } from '@nestjs/common';

// Un trajet/une demande ne peut etre planifie que pour aujourd'hui ou demain
// -- au-dela, personne ne sait vraiment qui aura besoin d'un trajet dans 3
// jours, et ca fragmentait l'offre sur des dizaines de creneaux jamais
// consultes. "Demain" s'arrete a minuit (heure serveur -- Abidjan est en
// UTC+0, meme heure), pas de decoupage a l'heure pres. Cote d'Ivoire n'a pas
// de changement d'heure saisonnier, donc l'heure serveur (UTC) correspond
// toujours a l'heure locale.
// Delai minimum entre la creation et le depart. Identique a
// DemandesService.EXPIRATION_DEADLINE_MS : sans ce garde-fou, une demande
// creee pour "dans 45 min" naissait deja dans la zone d'expiration et le cron
// la supprimait dans la minute -- l'app confirmait la creation puis la
// demande disparaissait sans explication. Mieux vaut refuser tout de suite
// avec un message clair.
const DELAI_MINIMUM_MS = 75 * 60 * 1000;

export function verifierFenetreReservation(heure: Date): void {
  const maintenant = new Date();
  if (heure.getTime() <= maintenant.getTime()) {
    throw new BadRequestException("L'heure de départ doit être dans le futur.");
  }

  if (heure.getTime() - maintenant.getTime() < DELAI_MINIMUM_MS) {
    throw new BadRequestException(
      "Choisis une heure de départ dans au moins 1h15 : en dessous, personne n'aurait le temps de te rejoindre.",
    );
  }

  const finDeDemain = new Date(maintenant);
  finDeDemain.setHours(0, 0, 0, 0);
  finDeDemain.setDate(finDeDemain.getDate() + 2);

  if (heure.getTime() >= finDeDemain.getTime()) {
    throw new BadRequestException(
      "Tu ne peux réserver que pour aujourd'hui ou demain.",
    );
  }
}
