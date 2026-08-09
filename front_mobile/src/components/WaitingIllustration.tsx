import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme';

// Illustration simple pour faire patienter pendant qu'on cherche le point
// de regroupement (radar + épingle) -- évite d'afficher un écran vide
// pendant que le calcul se fait côté serveur.
export function WaitingIllustration({ style }: { style?: object }) {
  return (
    <View style={[styles.wrap, style]}>
      <Svg width={120} height={120} viewBox="0 0 120 120" fill="none">
        <Circle cx={60} cy={60} r={54} stroke={colors.neutral300} strokeWidth={2} />
        <Circle cx={60} cy={60} r={38} stroke={colors.neutral400} strokeWidth={2} />
        <Circle cx={60} cy={60} r={22} stroke={colors.accent300} strokeWidth={2} />
        <Path
          d="M60 40c-8 0-14 6-14 14 0 10 14 26 14 26s14-16 14-26c0-8-6-14-14-14z"
          fill={colors.accent}
        />
        <Circle cx={60} cy={54} r={5} fill={colors.background} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
});
