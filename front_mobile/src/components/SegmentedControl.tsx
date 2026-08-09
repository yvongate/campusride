import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts } from '../theme';

export interface SegmentOption {
  value: string;
  label: string;
}

// .seg / .seg-opt de UI_inspo/_ds/.../styles.css : conteneur bordure divider,
// option selectionnee = fond accent + texte clair.
export function SegmentedControl({
  options,
  value,
  onChange,
  block,
}: {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  block?: boolean;
}) {
  return (
    <View style={[styles.container, block && styles.block]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.option,
              block && styles.optionBlock,
              selected && styles.optionSelected,
            ]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.text, selected && styles.textSelected]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 8,
  },
  block: {
    alignSelf: 'stretch',
  },
  option: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  optionBlock: {
    flex: 1,
    alignItems: 'center',
  },
  optionSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text,
  },
  textSelected: {
    color: colors.background,
  },
});
