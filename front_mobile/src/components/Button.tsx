import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { colors, fonts } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost';

interface Props extends TouchableOpacityProps {
  title: string;
  variant?: Variant;
  block?: boolean;
  loading?: boolean;
}

// btn-primary/secondary/ghost + btn-block de UI_inspo/_ds/.../styles.css.
export function Button({
  title,
  variant = 'primary',
  block,
  loading,
  disabled,
  style,
  ...props
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        block && styles.block,
        isDisabled && styles.disabled,
        style,
      ]}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.background : colors.accent}
        />
      ) : (
        <Text
          style={[
            styles.text,
            variant === 'primary' && styles.textPrimary,
            variant === 'secondary' && styles.textSecondary,
            variant === 'ghost' && styles.textGhost,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: 'transparent',
  },
  ghost: {
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
  },
  block: {
    width: '100%',
  },
  disabled: {
    opacity: 0.45,
  },
  text: {
    fontFamily: fonts.heading,
    fontSize: 14,
  },
  textPrimary: {
    color: colors.background,
  },
  textSecondary: {
    color: colors.text,
  },
  textGhost: {
    color: colors.accent,
  },
});
