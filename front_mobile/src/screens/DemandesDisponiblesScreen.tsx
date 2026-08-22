import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { AxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import {
  accepterDemande,
  getProfile,
  listCommunes,
  listerDemandesDisponibles,
  Commune,
  DemandeDisponible,
} from '../api/client';
import { useRefreshOnForeground } from '../hooks/useRefreshOnForeground';
import { Button } from '../components/Button';
import { DemandeDisponibleCard } from '../components/DemandeDisponibleCard';
import { BoutonRemonter, useRemonterEnHaut } from '../components/BoutonRemonter';
import { ErrorState } from '../components/ErrorState';
import { showError } from '../components/Toast';
import { PickerField } from '../components/PickerField';
import { ScreenHeader } from '../components/ScreenHeader';
import { MutedText } from '../components/Typography';

type Props = NativeStackScreenProps<RootStackParamList, 'DemandesDisponibles'>;

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export default function DemandesDisponiblesScreen({ navigation }: Props) {
  const [communes, setCommunes] = useState<Commune[]>([]);
  // Un conducteur "les deux" (etudiant + conducteur) reste scope a sa propre
  // universite (celle de son profil, voir ChoisirUniversiteScreen) -- lui
  // faire aussi choisir une universite ici n'aurait pas de sens. Un
  // conducteur "chauffeur" (pas etudiant, voir Profile.role) n'en a pas :
  // universiteId reste alors null et listerDemandesDisponibles ne filtre
  // simplement pas dessus (toutes les universites de la commune).
  const [universiteId, setUniversiteId] = useState<string | null>(null);
  const [universiteNom, setUniversiteNom] = useState<string | null>(null);
  const [communeId, setCommuneId] = useState<string | null>(null);
  const [demandes, setDemandes] = useState<DemandeDisponible[]>([]);
  const [loadingReferentiel, setLoadingReferentiel] = useState(true);
  const [referentielError, setReferentielError] = useState<string | null>(null);
  const [loadingDemandes, setLoadingDemandes] = useState(false);
  const [demandesError, setDemandesError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { listRef, visible, onScroll, remonter } =
    useRemonterEnHaut<DemandeDisponible>();

  const loadReferentiel = useCallback(async () => {
    setLoadingReferentiel(true);
    setReferentielError(null);
    try {
      const [profile, communesData] = await Promise.all([
        getProfile(),
        listCommunes(),
      ]);
      setUniversiteId(profile.universiteId);
      setUniversiteNom(profile.universite?.nom ?? null);
      setCommunes(communesData);
    } catch (e) {
      setReferentielError(
        extractErrorMessage(e, 'Impossible de charger les filtres.'),
      );
    } finally {
      setLoadingReferentiel(false);
    }
  }, []);

  useEffect(() => {
    void loadReferentiel();
  }, [loadReferentiel]);

  const loadDemandes = useCallback(async () => {
    if (!communeId) return;
    setLoadingDemandes(true);
    setDemandesError(null);
    try {
      setDemandes(
        await listerDemandesDisponibles(communeId, universiteId ?? undefined),
      );
    } catch (e) {
      setDemandesError(
        extractErrorMessage(e, 'Impossible de charger les demandes.'),
      );
    } finally {
      setLoadingDemandes(false);
    }
  }, [universiteId, communeId]);

  useEffect(() => {
    void loadDemandes();
  }, [loadDemandes]);

  useRefreshOnForeground(loadDemandes);

  // Sans ca, revenir sur cet ecran apres avoir accepte une demande (ou
  // apres un aller-retour vers un autre onglet) laissait la carte deja
  // acceptee affichee -- un 2e tap dessus echouait alors avec un message
  // deroutant plutot que de simplement avoir disparu de la liste.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadDemandes);
    return unsubscribe;
  }, [navigation, loadDemandes]);

  async function handleAccepter(demandeId: string) {
    setPendingId(demandeId);
    try {
      await accepterDemande(demandeId);
      navigation.navigate('MesTrajetsConducteur');
    } catch (e) {
      showError(extractErrorMessage(e, "L'acceptation a échoué."));
      void loadDemandes();
    } finally {
      setPendingId(null);
    }
  }

  if (loadingReferentiel) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (referentielError) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Demandes disponibles" onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <ErrorState message={referentielError} onRetry={loadReferentiel} />
        </View>
      </View>
    );
  }

  const communeLabel = communes.find((c) => c.id === communeId)?.nom ?? null;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Demandes disponibles"
        subtitle={universiteNom ?? undefined}
        onBack={() => navigation.goBack()}
      />

      <View style={styles.filters}>
        <PickerField
          label="Commune de départ"
          placeholder="Choisir une commune"
          selectedLabel={communeLabel}
          options={communes.map((c) => ({ id: c.id, label: c.nom }))}
          onSelect={setCommuneId}
        />
      </View>


      {communeId ? (
        loadingDemandes && demandes.length === 0 ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : demandesError && demandes.length === 0 ? (
          <ErrorState message={demandesError} onRetry={loadDemandes} />
        ) : (
          <FlatList
            ref={listRef}
            onScroll={onScroll}
            scrollEventThrottle={16}
            data={demandes}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={loadingDemandes}
                onRefresh={loadDemandes}
                tintColor={colors.accent}
              />
            }
            ListHeaderComponent={
              <>
                {demandesError ? (
                  <Text style={styles.error}>{demandesError}</Text>
                ) : null}
                <MutedText style={styles.count}>
                  {demandes.length} demande{demandes.length > 1 ? 's' : ''}{' '}
                  correspondent à ces filtres
                </MutedText>
              </>
            }
            ListEmptyComponent={
              <MutedText style={styles.empty}>Aucune demande disponible.</MutedText>
            }
            renderItem={({ item }) => (
              <DemandeDisponibleCard
                demande={item}
                pending={pendingId === item.id}
                onAccepter={() => void handleAccepter(item.id)}
              />
            )}
          />
        )
      ) : (
        <MutedText style={styles.empty}>
          Choisis ta commune de départ pour voir les demandes.
        </MutedText>
      )}

      <BoutonRemonter visible={visible} onPress={remonter} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filters: {
    paddingHorizontal: 20,
  },
  loader: {
    marginTop: 24,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  count: {
    fontSize: 11.5,
    marginBottom: 4,
  },
  card: {
    marginBottom: 0,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: fonts.heading,
    fontSize: 14.5,
    color: colors.text,
  },
  time: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 13,
    color: colors.text,
  },
  cardBody: {
    fontSize: 13,
  },
  total: {
    fontFamily: fonts.headingSemiBold,
    color: colors.text,
  },
  empty: {
    textAlign: 'center',
    marginTop: 24,
  },
  error: {
    color: colors.accent,
    fontSize: 13,
    marginHorizontal: 20,
    marginBottom: 8,
  },
});
