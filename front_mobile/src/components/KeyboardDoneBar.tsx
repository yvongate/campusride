import { InputAccessoryView, Keyboard, Platform, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, fonts } from '../theme';

// iOS n'affiche aucune touche de retour/validation pour keyboardType
// "number-pad" (contrairement a Android) -- cette barre au-dessus du
// clavier comble ce manque partout ou elle est utilisee (voir Input dans
// Field.tsx, ConnexionScreen, VerificationOtpScreen).
export const KEYBOARD_ACCESSORY_ID = 'campusride-keyboard-done';

export function KeyboardDoneBar() {
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={KEYBOARD_ACCESSORY_ID}>
      <TouchableOpacity style={styles.bar} onPress={() => Keyboard.dismiss()} hitSlop={8}>
        <Text style={styles.text}>✓ Terminé</Text>
      </TouchableOpacity>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  text: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.accent,
  },
});
