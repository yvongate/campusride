import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, fonts } from '../theme';
import { KEYBOARD_ACCESSORY_ID, KeyboardDoneBar } from './KeyboardDoneBar';

// .field > label + .input de UI_inspo/_ds/.../styles.css.
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

export function Input({ style, ...props }: TextInputProps) {
  return (
    <>
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={colors.textMuted}
        inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_ACCESSORY_ID : undefined}
        {...props}
      />
      <KeyboardDoneBar />
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 12,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 5,
  },
  input: {
    minHeight: 36,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
});
