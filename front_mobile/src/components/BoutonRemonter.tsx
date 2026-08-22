import { useRef, useState } from 'react';
import type { FlatList } from 'react-native';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors, shadows } from '../theme';
import { ChevronUpIcon } from './icons';

// Au-dela de deux ecrans de defilement environ. En dessous, un simple geste
// suffit a revenir en haut : afficher le bouton trop tot le rendrait present
// en permanence et masquerait du contenu pour rien.
const SEUIL_AFFICHAGE = 900;

// Regroupe l'etat et la ref necessaires au bouton "remonter". Retourne de quoi
// brancher n'importe quelle FlatList : la ref, le handler de defilement, et
// la visibilite calculee.
export function useRemonterEnHaut<T>() {
  const listRef = useRef<FlatList<T>>(null);
  const [visible, setVisible] = useState(false);

  function onScroll(evenement: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = evenement.nativeEvent.contentOffset.y;
    // setState seulement au franchissement du seuil : appele a chaque frame
    // de defilement, un setState systematique re-rendrait toute la liste.
    setVisible((actuel) => {
      const devrait = y > SEUIL_AFFICHAGE;
      return devrait === actuel ? actuel : devrait;
    });
  }

  function remonter() {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  return { listRef, visible, onScroll, remonter };
}

export function BoutonRemonter({
  visible,
  onPress,
  bottom = 24,
}: {
  visible: boolean;
  onPress: () => void;
  // Remonte le bouton quand un autre element flottant occupe deja le coin
  // (le "+" de l'accueil, par exemple).
  bottom?: number;
}) {
  if (!visible) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[styles.bouton, { bottom }]}
      onPress={onPress}
      accessibilityLabel="Remonter en haut de la liste"
      hitSlop={6}
    >
      <ChevronUpIcon color={colors.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bouton: {
    position: 'absolute',
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutral100,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
});
