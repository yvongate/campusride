import { SetMetadata } from '@nestjs/common';

export const AUTORISE_SI_SUSPENDU_KEY = 'autoriseSiSuspendu';

// A poser sur les (rares) routes qui doivent rester joignables par un compte
// suspendu. Sans ca, la suspension automatique (§8.2) serait un cul-de-sac :
// la personne ne pourrait meme pas contester une sanction prise a tort.
// N'en decorer QUE le strict necessaire -- lire son profil et ecrire au
// support -- surtout aucune route qui creerait ou rejoindrait un trajet.
export const AutoriseSiSuspendu = () =>
  SetMetadata(AUTORISE_SI_SUSPENDU_KEY, true);
