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
