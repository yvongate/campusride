import * as SecureStore from 'expo-secure-store';

// Aucune notification push reelle dans ce projet (voir back/) -- quand le
// createur annule une demande, les autres participants n'apprennent le
// changement qu'au prochain chargement de "Mes demandes en cours". Ce
// registre local sert a n'afficher le toast qu'une seule fois par demande
// annulee, meme apres redemarrage de l'app (sinon le toast reviendrait a
// chaque focus tant que le participant n'a pas quitte/rejoint autre chose).
const CLE = 'demandesAnnuleesVues';

export async function getDemandesAnnuleesVues(): Promise<Set<string>> {
  const brut = await SecureStore.getItemAsync(CLE);
  if (!brut) return new Set();
  try {
    const liste = JSON.parse(brut) as string[];
    return new Set(liste);
  } catch {
    return new Set();
  }
}

export async function marquerDemandeAnnuleeVue(demandeId: string): Promise<void> {
  const vues = await getDemandesAnnuleesVues();
  vues.add(demandeId);
  await SecureStore.setItemAsync(CLE, JSON.stringify([...vues]));
}
