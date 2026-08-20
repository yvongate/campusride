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
import { Stepper } from '../components/Stepper';
import { showError } from '../components/Toast';
import {
  bornesFenetreReservation,
  premiereHeureValide,
} from '../utils/fenetreReservation';

type Props = NativeStackScreenProps<RootStackParamList, 'PublierTrajet'>;

// Plafond identique cote backend (common/limites.ts) -- le conducteur choisit
// desormais librement dans cette limite, au lieu d'annoncer 4 places quelle
// que soit la voiture.
const PLACES_MAX = 4;

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
  const [dateHeure, setDateHeure] = useState(premiereHeureValide);
  const [placesProposees, setPlacesProposees] = useState(PLACES_MAX);
  const [cotisation, setCotisation] = useState('');
  const [loadingReferentiel, setLoadingReferentiel] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fenetre = bornesFenetreReservation();

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
    const cotisationNum = parseFloat(cotisation);
    if (!Number.isFinite(cotisationNum) || cotisationNum < 1) {
      setError('Indique une cotisation valide.');
      return;
    }

    setSubmitting(true);
    try {
      await publierTrajet({
        universiteId,
        pointDeRdvId,
        heure: dateHeure.toISOString(),
        places: placesProposees,
        cotisation: cotisationNum,
      });
      navigation.replace('MesTrajetsConducteur');
    } catch (e) {
      showError(extractErrorMessage(e, 'La publication du trajet a échoué.'));
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
  const cotisationNum = parseFloat(cotisation);
  // Ce que le conducteur encaissera si toutes les places se remplissent --
  // simple projection indicative, le montant du par chaque passager reste la
  // cotisation saisie quoi qu'il arrive.
  const totalSiComplet =
    Number.isFinite(cotisationNum) && cotisationNum > 0
      ? cotisationNum * placesProposees
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
              minimumDate={fenetre.minimumDate}
              maximumDate={fenetre.maximumDate}
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

        <Field
          label={`Je propose ${placesProposees} place${placesProposees > 1 ? 's' : ''}`}
        >
          <Stepper
            value={placesProposees}
            onChange={setPlacesProposees}
            min={1}
            max={PLACES_MAX}
          />
        </Field>

        <Field label="Cotisation par personne">
          <Input
            placeholder="875 FCFA"
            value={cotisation}
            onChangeText={setCotisation}
            keyboardType="number-pad"
          />
        </Field>

        {totalSiComplet !== null ? (
          <View style={styles.callout}>
            <Text style={styles.calloutText}>
              Chaque passager paie {cotisationNum} FCFA, quel que soit le
              nombre de réservations. Tu encaisseras {totalSiComplet} FCFA si
              tes {placesProposees} place{placesProposees > 1 ? 's se remplissent' : ' se remplit'}.
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
