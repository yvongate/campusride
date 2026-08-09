import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

// Barre CTA collee en bas (surface + bordure superieure divider), commune a
// la plupart des ecrans "pousses". Ajoute l'inset bas reel (home indicator
// iPhone) par-dessus le padding visuel de 24, au lieu d'une valeur fixe qui
// laisserait le CTA trop pres du bord sur les appareils avec indicateur.
export function ScreenFooter({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    padding: 20,
    backgroundColor: colors.surface,
    borderTopWidth: 2,
    borderTopColor: colors.divider,
  },
});
