import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts } from '../theme';

// Champ "Places" avec boutons -/+ de UI_inspo (ecrans 6 et 13).
export function Stepper({
  value,
  min = 1,
  max = 8,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.input}>
      <TouchableOpacity
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        hitSlop={8}
      >
        <Text style={[styles.symbol, value <= min && styles.disabled]}>−</Text>
      </TouchableOpacity>
      <Text style={styles.value}>{value}</Text>
      <TouchableOpacity
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        hitSlop={8}
      >
        <Text style={[styles.symbolAccent, value >= max && styles.disabled]}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 36,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  symbol: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  symbolAccent: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.accent,
  },
  disabled: {
    opacity: 0.35,
  },
  value: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.text,
  },
});
