import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import {
  listCommunes,
  listPointsInteret,
  listQuartiers,
  listUniversites,
  publierTrajet,
  Commune,
  PointInteret,
  Quartier,
  Universite,
} from '../api/client';
import { Button } from '../components/Button';
import { DateTimeField } from '../components/DateTimeField';
import { Field, Input } from '../components/Field';
import { PickerField } from '../components/PickerField';
import { ScreenFooter } from '../components/ScreenFooter';
import { ScreenHeader } from '../components/ScreenHeader';

type Props = NativeStackScreenProps<RootStackParamList, 'PublierTrajet'>;

// 4 passagers au total (chauffeur non compris) -- meme regle que pour une
// demande, un conducteur ne choisit pas ce nombre.
const PLACES_TRAJET = 4;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateLabel(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatHeureLabel(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export default function PublierTrajetScreen({ navigation }: Props) {
  const [universites, setUniversites] = useState<Universite[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [quartiers, setQuartiers] = useState<Quartier[]>([]);
  const [pointsInteret, setPointsInteret] = useState<PointInteret[]>([]);
  const [universiteId, setUniversiteId] = useState<string | null>(null);
  const [communeId, setCommuneId] = useState<string | null>(null);
  const [quartierId, setQuartierId] = useState<string | null>(null);
  const [pointDeRdvId, setPointDeRdvId] = useState<string | null>(null);
  const [dateHeure, setDateHeure] = useState(() => new Date());
  const [prixTotal, setPrixTotal] = useState('');
  const [loadingReferentiel, setLoadingReferentiel] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!communeId) {
      setQuartiers([]);
      setQuartierId(null);
      return;
    }
    listQuartiers(communeId).then(setQuartiers);
  }, [communeId]);

  useEffect(() => {
    if (!quartierId) {
      setPointsInteret([]);
      setPointDeRdvId(null);
      return;
    }
    listPointsInteret(quartierId).then(setPointsInteret);
  }, [quartierId]);

  async function handleSubmit() {
    setError(null);

    if (!universiteId || !pointDeRdvId) {
      setError('Choisis une université et un point de rendez-vous.');
      return;
    }
    const prixNum = parseFloat(prixTotal);
    if (!Number.isFinite(prixNum) || prixNum < 1) {
      setError('Prix total invalide.');
      return;
    }

    setSubmitting(true);
    try {
      await publierTrajet({
        universiteId,
        pointDeRdvId,
        heure: dateHeure.toISOString(),
        places: PLACES_TRAJET,
        prixTotal: prixNum,
      });
      navigation.replace('MesTrajetsConducteur');
    } catch (e) {
      setError(extractErrorMessage(e, 'La publication du trajet a échoué.'));
    } finally {
      setSubmitting(false);
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
  const quartierLabel = quartiers.find((q) => q.id === quartierId)?.nom ?? null;
  const pointLabel = pointsInteret.find((p) => p.id === pointDeRdvId)?.nom ?? null;
  const prixNum = parseFloat(prixTotal);
  const prixParPersonne =
    Number.isFinite(prixNum) && prixNum > 0
      ? Math.ceil(prixNum / PLACES_TRAJET)
      : null;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Publier un trajet" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        <PickerField
          label="Université de destination"
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
        <PickerField
          label="Quartier"
          placeholder={communeId ? 'Choisir un quartier' : "Choisis une commune d'abord"}
          selectedLabel={quartierLabel}
          options={quartiers.map((q) => ({ id: q.id, label: q.nom }))}
          onSelect={setQuartierId}
          disabled={!communeId}
        />
        <PickerField
          label="Point de rendez-vous"
          placeholder={quartierId ? 'Choisir un point de rendez-vous' : "Choisis un quartier d'abord"}
          selectedLabel={pointLabel}
          options={pointsInteret.map((p) => ({ id: p.id, label: p.nom }))}
          onSelect={setPointDeRdvId}
          disabled={!quartierId}
        />

        <View style={styles.row}>
          <View style={styles.rowField}>
            <DateTimeField
              label="Date"
              mode="date"
              value={dateHeure}
              onChange={setDateHeure}
              formatLabel={formatDateLabel}
            />
          </View>
          <View style={styles.rowField}>
            <DateTimeField
              label="Heure"
              mode="time"
              value={dateHeure}
              onChange={setDateHeure}
              formatLabel={formatHeureLabel}
            />
          </View>
        </View>

        <Field label="Prix total du trajet">
          <Input
            placeholder="3 500 FCFA"
            value={prixTotal}
            onChangeText={setPrixTotal}
            keyboardType="number-pad"
          />
        </Field>

        {prixParPersonne !== null ? (
          <View style={styles.callout}>
            <Text style={styles.calloutText}>
              ≈ {prixParPersonne} FCFA par personne, calculé automatiquement
              pour {PLACES_TRAJET} passagers.
            </Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <ScreenFooter>
        <Button
          title="Publier le trajet"
          block
          loading={submitting}
          onPress={() => void handleSubmit()}
        />
      </ScreenFooter>
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowField: {
    flex: 1,
  },
  callout: {
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  calloutText: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.accent700,
  },
  error: {
    color: colors.accent,
    fontSize: 13,
    marginBottom: 12,
  },
});
