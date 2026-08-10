import { useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { colors, fonts } from '../theme';
import { Field } from './Field';

// Roue native (spinner) pour la date/l'heure -- remplace les champs texte
// JJ/MM/AAAA et HH:mm, mêmes maquettes/mécanique de picker plein-écran que
// PickerField (Modal + bouton "Terminé").
export function DateTimeField({
  label,
  mode,
  value,
  onChange,
  formatLabel,
}: {
  label: string;
  mode: 'date' | 'time';
  value: Date;
  onChange: (date: Date) => void;
  formatLabel: (date: Date) => string;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  function handleAndroidChange(event: DateTimePickerEvent, selected?: Date) {
    if (event.type === 'set' && selected) {
      onChange(selected);
    }
  }

  function handlePress() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode,
        display: 'spinner',
        onChange: handleAndroidChange,
      });
    } else {
      setOpen(true);
    }
  }

  function handleIosChange(_event: DateTimePickerEvent, selected?: Date) {
    if (selected) onChange(selected);
  }

  return (
    <Field label={label}>
      <TouchableOpacity style={styles.row} onPress={handlePress}>
        <Text style={styles.text}>{formatLabel(value)}</Text>
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
          <View
            style={[
              styles.modalContainer,
              { paddingTop: insets.top + 24, paddingBottom: insets.bottom },
            ]}
          >
            <DateTimePicker
              value={value}
              mode={mode}
              display="spinner"
              textColor={colors.text}
              onChange={handleIosChange}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setOpen(false)}>
              <Text style={styles.modalCloseText}>Terminé</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </Field>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    justifyContent: 'flex-end',
  },
  modalClose: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalCloseText: {
    fontFamily: fonts.headingSemiBold,
    color: colors.accent,
  },
});
