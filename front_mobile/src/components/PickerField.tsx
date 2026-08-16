import { useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { ChevronRightIcon } from './icons';
import { Field } from './Field';

export interface PickerOption {
  id: string;
  label: string;
  sublabel?: string;
}

export function normalise(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// .field > .input avec chevron-right de UI_inspo (ex. écrans 6, 13) --
// ouvre une liste plein-écran, même mécanique que le picker déjà établi
// dans AccueilScreen mais factorisée pour être réutilisée partout.
// `searchable` ajoute un champ de recherche en tête de liste -- réservé aux
// listes longues (université ~430, point de repère ~95) ; les listes courtes
// (commune, quartier) restent en simple liste, la recherche y serait un
// obstacle de plus plutôt qu'une aide.
export function PickerField({
  label,
  placeholder,
  selectedLabel,
  options,
  onSelect,
  disabled,
  searchable,
}: {
  label: string;
  placeholder: string;
  selectedLabel: string | null;
  options: PickerOption[];
  onSelect: (id: string) => void;
  disabled?: boolean;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = normalise(query.trim());
    return options.filter(
      (o) => normalise(o.label).includes(q) || (o.sublabel && normalise(o.sublabel).includes(q)),
    );
  }, [options, query, searchable]);

  function handleClose() {
    setOpen(false);
    setQuery('');
  }

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
      <Modal visible={open} animationType="slide" onRequestClose={handleClose}>
        <View
          style={[
            styles.modalContainer,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom },
          ]}
        >
          {searchable ? (
            <TextInput
              style={styles.search}
              placeholder="Rechercher…"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoFocus
            />
          ) : null}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              searchable ? (
                <Text style={styles.emptyText}>Aucun résultat.</Text>
              ) : null
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  onSelect(item.id);
                  handleClose();
                }}
              >
                <Text style={styles.modalItemText}>{item.label}</Text>
                {item.sublabel ? (
                  <Text style={styles.modalItemSublabel}>{item.sublabel}</Text>
                ) : null}
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.modalClose} onPress={handleClose}>
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
  search: {
    minHeight: 40,
    marginBottom: 12,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalItemSublabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
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
