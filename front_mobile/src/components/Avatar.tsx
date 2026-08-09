import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts } from '../theme';

interface Props {
  initial: string;
  size?: number;
  background?: string;
  color?: string;
  style?: ViewStyle;
}

// Carre avec initiale de UI_inspo (ex. avatar profil, avatar liste passagers)
// -- pas de cercle, coherent avec le design plat (radius 0) de la maquette.
export function Avatar({
  initial,
  size = 44,
  background = colors.text,
  color = colors.background,
  style,
}: Props) {
  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, backgroundColor: background },
        style,
      ]}
    >
      <Text
        style={[styles.text, { fontSize: size * 0.36, color }]}
      >
        {initial.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: fonts.heading,
  },
});
