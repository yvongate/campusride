import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { AxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import {
  accepterDemande,
  listCommunes,
  listUniversites,
  listerDemandesDisponibles,
  Commune,
  DemandeDisponible,
  Universite,
} from '../api/client';
import { getDisplayName } from '../utils/profile';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
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
  const [universites, setUniversites] = useState<Universite[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [universiteId, setUniversiteId] = useState<string | null>(null);
  const [communeId, setCommuneId] = useState<string | null>(null);
  const [demandes, setDemandes] = useState<DemandeDisponible[]>([]);
  const [loadingReferentiel, setLoadingReferentiel] = useState(true);
  const [loadingDemandes, setLoadingDemandes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadReferentiel = useCallback(async () => {
    setLoadingReferentiel(true);
    try {
      const [universitesData, communesData] = await Promise.all([
        listUniversites(),
        listCommunes(),
      ]);
      setUniversites(universitesData);
      setCommunes(communesData);
    } finally {
      setLoadingReferentiel(false);
    }
  }, []);

  useEffect(() => {
    void loadReferentiel();
  }, [loadReferentiel]);

  const loadDemandes = useCallback(async () => {
    if (!universiteId || !communeId) return;
    setLoadingDemandes(true);
    try {
      setDemandes(await listerDemandesDisponibles(universiteId, communeId));
    } finally {
      setLoadingDemandes(false);
    }
  }, [universiteId, communeId]);

  useEffect(() => {
    void loadDemandes();
  }, [loadDemandes]);

  async function handleAccepter(demandeId: string) {
    setError(null);
    setPendingId(demandeId);
    try {
      await accepterDemande(demandeId);
      navigation.navigate('MesTrajetsConducteur');
    } catch (e) {
      setError(extractErrorMessage(e, "L'acceptation a échoué."));
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

  const universiteLabel = universites.find((u) => u.id === universiteId)?.nom ?? null;
  const communeLabel = communes.find((c) => c.id === communeId)?.nom ?? null;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Demandes disponibles" onBack={() => navigation.goBack()} />

      <View style={styles.filters}>
        <PickerField
          label="Université"
          placeholder="Choisir une université"
          selectedLabel={universiteLabel}
          options={universites.map((u) => ({ id: u.id, label: u.nom }))}
          onSelect={setUniversiteId}
        />
        <PickerField
          label="Commune de départ"
          placeholder="Choisir une commune"
          selectedLabel={communeLabel}
          options={communes.map((c) => ({ id: c.id, label: c.nom }))}
          onSelect={setCommuneId}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {universiteId && communeId ? (
        loadingDemandes ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : (
          <FlatList
            data={demandes}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <MutedText style={styles.count}>
                {demandes.length} demande{demandes.length > 1 ? 's' : ''}{' '}
                correspondent à ces filtres
              </MutedText>
            }
            ListEmptyComponent={
              <MutedText style={styles.empty}>Aucune demande disponible.</MutedText>
            }
            renderItem={({ item }) => {
              const nom = getDisplayName(item.createur.nom, item.createur.prenom, 'Étudiant');
              return (
                <Card style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle}>
                      {item.poi.nom} → université
                    </Text>
                    <Text style={styles.time}>
                      {new Date(item.heure).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Avatar initial={nom.charAt(0)} size={22} background={colors.accent300} color={colors.text} />
                  <MutedText style={styles.cardBody}>
                    {item.placesRecherchees} passagers · point suggéré :{' '}
                    {item.poi.nom} ·{' '}
                    <Text style={styles.total}>
                      {item.placesRecherchees * item.cotisation} FCFA
                    </Text>{' '}
                    total
                  </MutedText>
                  <Button
                    title={pendingId === item.id ? '...' : 'Voir & accepter'}
                    block
                    loading={pendingId === item.id}
                    onPress={() => void handleAccepter(item.id)}
                  />
                </Card>
              );
            }}
          />
        )
      ) : (
        <MutedText style={styles.empty}>
          Choisis ton université et ta commune pour voir les demandes.
        </MutedText>
      )}
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
