import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Utilise par l'intercepteur axios (client.ts) quand une requete renvoie 401
// en cours de session (token expire/revoque) -- pas de contexte React
// disponible a cet endroit, d'ou le ref global.
export function resetToConnexion() {
  if (navigationRef.isReady()) {
    navigationRef.reset({ index: 0, routes: [{ name: 'Connexion' }] });
  }
}

// Meme principe pour le 403 "COMPTE_SUSPENDU" : un reset (et non un navigate)
// pour qu'aucun ecran de l'app ne reste accessible via le bouton retour --
// mais on ne touche PAS au token, l'ecran de recours en a besoin.
export function resetToCompteSuspendu(suspenduJusqua: string | null) {
  if (navigationRef.isReady()) {
    navigationRef.reset({
      index: 0,
      routes: [{ name: 'CompteSuspendu', params: { suspenduJusqua } }],
    });
  }
}
