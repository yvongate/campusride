import * as SecureStore from 'expo-secure-store';

// Noter un trajet n'est pas obligatoire (voir rappel sur AccueilScreen) --
// une fois qu'un utilisateur ignore un rappel, il ne doit plus jamais
// reapparaitre pour ce trajet, meme apres redemarrage de l'app. Persiste
// donc localement (le backend n'a aucune notion d'un rappel "ignore", et
// n'a pas besoin d'en avoir).
const CLE = 'notationsIgnorees';

export async function getTrajetsIgnores(): Promise<Set<string>> {
  const brut = await SecureStore.getItemAsync(CLE);
  if (!brut) return new Set();
  try {
    const liste = JSON.parse(brut) as string[];
    return new Set(liste);
  } catch {
    return new Set();
  }
}

export async function ignorerTrajet(trajetId: string): Promise<void> {
  const ignores = await getTrajetsIgnores();
  ignores.add(trajetId);
  await SecureStore.setItemAsync(CLE, JSON.stringify([...ignores]));
}
