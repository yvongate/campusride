import type { ReactNode } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { ChevronLeftIcon } from './icons';
import { H4, MutedText } from './Typography';

// En-tete des ecrans "pousses" (Stack, sans header natif) : chevron retour +
// titre, memes marges que les headers de UI_inspo (padding 66/20/12-14).
// La maquette (device frame) n'a pas ce chevron car son "header" simule
// l'OS ; ici la navigation reelle en a besoin.
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  surface,
  right,
}: {
  title: string;
  subtitle?: string;
  // Optionnel : un ecran rendu comme onglet racine n'a aucune destination de
  // retour, un chevron y serait inerte.
  onBack?: () => void;
  surface?: boolean;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 16 }, surface && styles.surface]}>
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={8} style={styles.back}>
            <ChevronLeftIcon />
          </TouchableOpacity>
        ) : null}
        <View style={styles.titleBlock}>
          <H4 numberOfLines={2}>{title}</H4>
          {subtitle ? <MutedText style={styles.subtitle}>{subtitle}</MutedText> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  surface: {
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.divider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  back: {
    padding: 2,
  },
  titleBlock: {
    flex: 1,
  },
  subtitle: {
    fontSize: 12.5,
    marginTop: 2,
  },
});
