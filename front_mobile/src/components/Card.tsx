import { StyleSheet, View, ViewProps } from 'react-native';
import { colors, spacing } from '../theme';

// .card de UI_inspo/_ds/.../styles.css : bg surface, padding 12, gap 8, radius 0.
export function Card({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    padding: spacing.s3,
    gap: spacing.s2,
  },
});
