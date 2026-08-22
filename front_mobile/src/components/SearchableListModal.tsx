import { useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { normalise } from './PickerField';
import { BoutonRemonter, useRemonterEnHaut } from './BoutonRemonter';

export interface SearchableOption {
  id: string;
  label: string;
  sublabel?: string;
}

// Modal plein-ecran avec recherche en tete de liste -- extrait de PickerField
// pour etre pilotable depuis un declencheur personnalise (ex. la puce
// "universite" de l'Accueil), sans passer par le champ Field standard.
export function SearchableListModal({
  visible,
  title,
  options,
  onSelect,
  onClose,
  searchPlaceholder = 'Rechercher…',
}: {
  visible: boolean;
  title: string;
  options: SearchableOption[];
  onSelect: (id: string) => void;
  onClose: () => void;
  searchPlaceholder?: string;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const remonter = useRemonterEnHaut<SearchableOption>();

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = normalise(query.trim());
    return options.filter(
      (o) => normalise(o.label).includes(q) || (o.sublabel && normalise(o.sublabel).includes(q)),
    );
  }, [options, query]);

  function handleClose() {
    setQuery('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom },
        ]}
      >
        <Text style={styles.title}>{title}</Text>
        <TextInput
          style={styles.search}
          placeholder={searchPlaceholder}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoFocus
        />
        <FlatList
          ref={remonter.listRef}
          onScroll={remonter.onScroll}
          scrollEventThrottle={16}
          data={filtered}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.emptyText}>Aucun résultat.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => {
                onSelect(item.id);
                handleClose();
              }}
            >
              <Text style={styles.itemText}>{item.label}</Text>
              {item.sublabel ? (
                <Text style={styles.itemSublabel}>{item.sublabel}</Text>
              ) : null}
            </TouchableOpacity>
          )}
        />
        <BoutonRemonter
          visible={remonter.visible}
          onPress={remonter.remonter}
          bottom={72}
        />
        <TouchableOpacity style={styles.close} onPress={handleClose}>
          <Text style={styles.closeText}>Fermer</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
    marginBottom: 14,
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
  item: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  itemText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
  itemSublabel: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  close: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  closeText: {
    fontFamily: fonts.headingSemiBold,
    color: colors.accent,
  },
});
