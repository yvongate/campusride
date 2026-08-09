import { useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { ChevronRightIcon } from './icons';
import { Field } from './Field';

export interface PickerOption {
  id: string;
  label: string;
}

// .field > .input avec chevron-right de UI_inspo (ex. écrans 6, 13) --
// ouvre une liste plein-écran, même mécanique que le picker déjà établi
// dans AccueilScreen mais factorisée pour être réutilisée partout.
export function PickerField({
  label,
  placeholder,
  selectedLabel,
  options,
  onSelect,
  disabled,
}: {
  label: string;
  placeholder: string;
  selectedLabel: string | null;
  options: PickerOption[];
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <Field label={label}>
      <TouchableOpacity
        style={[styles.row, disabled && styles.rowDisabled]}
        onPress={() => !disabled && setOpen(true)}
      >
        <Text
          style={selectedLabel ? styles.text : styles.placeholder}
          numberOfLines={1}
        >
          {selectedLabel ?? placeholder}
        </Text>
        <ChevronRightIcon color={colors.text} />
      </TouchableOpacity>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View
          style={[
            styles.modalContainer,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom },
          ]}
        >
          <FlatList
            data={options}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  onSelect(item.id);
                  setOpen(false);
                }}
              >
                <Text style={styles.modalItemText}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.modalClose} onPress={() => setOpen(false)}>
            <Text style={styles.modalCloseText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </Field>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
    flexShrink: 1,
  },
  placeholder: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    flexShrink: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalItemText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
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
