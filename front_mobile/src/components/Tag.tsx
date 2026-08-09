import { StyleSheet, Text, View, ViewProps } from 'react-native';
import { colors } from '../theme';

type Variant = 'accent' | 'neutral' | 'outline';

interface Props extends ViewProps {
  label: string;
  variant?: Variant;
}

// .tag-accent/neutral/outline de UI_inspo/_ds/.../styles.css.
export function Tag({ label, variant = 'neutral', style, ...props }: Props) {
  return (
    <View
      style={[
        styles.base,
        variant === 'accent' && styles.accent,
        variant === 'neutral' && styles.neutral,
        variant === 'outline' && styles.outline,
        style,
      ]}
      {...props}
    >
      <Text
        style={[
          styles.text,
          variant === 'accent' && styles.textAccent,
          variant === 'neutral' && styles.textNeutral,
          variant === 'outline' && styles.textOutline,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  accent: {
    backgroundColor: colors.accent100,
  },
  neutral: {
    backgroundColor: colors.neutral100,
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
  textAccent: {
    color: colors.accent800,
  },
  textNeutral: {
    color: colors.neutral800,
  },
  textOutline: {
    color: colors.accent,
  },
});
