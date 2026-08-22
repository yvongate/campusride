import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AxiosError } from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import { listUniversites, updateUniversite, Universite } from '../api/client';
import { normalise } from '../components/PickerField';
import { Button } from '../components/Button';
import { ErrorState } from '../components/ErrorState';
import { showError } from '../components/Toast';
import { H3, MutedText } from '../components/Typography';
import { BoutonRemonter, useRemonterEnHaut } from '../components/BoutonRemonter';

type Props = NativeStackScreenProps<RootStackParamList, 'ChoisirUniversite'>;

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

// Etape du parcours ETUDIANT, atteinte depuis ChoisirProfilScreen. Le bouton
// "je suis chauffeur" a quitte cet ecran : le choix du profil se fait
// desormais avant (ChoisirProfilScreen), et un conducteur ne passe jamais
// ici -- lui presenter une liste d'universites n'avait aucun sens.
// L'universite est memorisee une fois puis reutilisee partout (Accueil,
// CreerDemande). Skippable comme le nom : ne jamais bloquer l'entree dans
// l'app. Modifiable a tout moment depuis "Mes informations".
export default function ChoisirUniversiteScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [universites, setUniversites] = useState<Universite[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { listRef, visible, onScroll, remonter } = useRemonterEnHaut<Universite>();

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    listUniversites()
      .then(setUniversites)
      .catch((e) =>
        setLoadError(extractErrorMessage(e, 'Impossible de charger la liste.')),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!query.trim()) return universites;
    const q = normalise(query.trim());
    return universites.filter(
      (u) => normalise(u.nom).includes(q) || normalise(u.commune).includes(q),
    );
  }, [universites, query]);

  async function handleSelect(universite: Universite) {
    setPendingId(universite.id);
    try {
      await updateUniversite(universite.id);
      navigation.navigate('Localisation');
    } catch (e) {
      showError(extractErrorMessage(e, "L'enregistrement a échoué."));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <H3 style={styles.title}>Ton université</H3>
      <MutedText style={styles.subtitle}>
        Pour te proposer les trajets et demandes qui te concernent.
      </MutedText>

      <TextInput
        style={styles.search}
        placeholder="Rechercher ton université…"
        placeholderTextColor={colors.textMuted}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
      />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.loader} />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : (
        <FlatList
          ref={listRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          data={filtered}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <MutedText style={styles.empty}>Aucun résultat.</MutedText>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              disabled={pendingId !== null}
              onPress={() => void handleSelect(item)}
            >
              <View style={styles.itemText}>
                <Text style={styles.itemNom} numberOfLines={2}>
                  {item.nom}
                </Text>
                <MutedText style={styles.itemCommune}>{item.commune}</MutedText>
              </View>
              {pendingId === item.id ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}

      <BoutonRemonter visible={visible} onPress={remonter} bottom={76} />

      <Button
        title="Passer pour l'instant"
        variant="ghost"
        block
        disabled={pendingId !== null}
        onPress={() => navigation.navigate('Localisation')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  title: {
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  search: {
    minHeight: 40,
    marginBottom: 4,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  loader: {
    marginTop: 24,
  },
  list: {
    flexGrow: 1,
    paddingVertical: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  itemText: {
    flex: 1,
  },
  itemNom: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
  itemCommune: {
    fontSize: 12,
    marginTop: 2,
  },
  empty: {
    textAlign: 'center',
    marginTop: 24,
  },
});
