import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

// Relance `onForeground` quand l'app revient au premier plan (retour depuis
// background/inactive) -- evite de laisser des donnees perimees affichees
// apres une longue mise en arriere-plan sans que l'utilisateur ait a tirer
// pour rafraichir ou changer d'ecran.
export function useRefreshOnForeground(onForeground: () => void) {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const callbackRef = useRef(onForeground);
  callbackRef.current = onForeground;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        callbackRef.current();
      }
      appState.current = next;
    });
    return () => subscription.remove();
  }, []);
}
