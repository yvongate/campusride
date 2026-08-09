import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts } from '../theme';

// .radio de UI_inspo (ecran 16) : ligne bordee, dot rempli d'accent quand
// selectionne.
export function RadioRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.dot, selected && styles.dotSelected]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 12,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.divider,
  },
  dotSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
});
