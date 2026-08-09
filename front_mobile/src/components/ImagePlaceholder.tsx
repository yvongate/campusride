import { Platform, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../theme';

// Equivalent du pattern hachure grise + libelle monospace utilise dans
// UI_inspo pour chaque image-slot sans asset reel (illustration, photo
// vehicule, carte GPS, documents...). Pas de veritable image ici -- ce
// projet n'a aucun asset d'illustration/carte, seul un texte descriptif
// entre crochets, exactement comme la maquette.
export function ImagePlaceholder({
  label,
  style,
}: {
  label: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.base, style]}>
      <Text style={styles.label}>[ {label} ]</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.neutral300,
    borderWidth: 1,
    borderColor: colors.neutral400,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  label: {
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
    fontSize: 10.5,
    color: colors.neutral700,
    textAlign: 'center',
  },
});
