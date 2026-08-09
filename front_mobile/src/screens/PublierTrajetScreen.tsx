import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import {
  listPointsInteret,
  listUniversites,
  publierTrajet,
  PointInteret,
  Universite,
} from '../api/client';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { PickerField } from '../components/PickerField';
import { ScreenFooter } from '../components/ScreenFooter';
import { ScreenHeader } from '../components/ScreenHeader';
import { Stepper } from '../components/Stepper';

type Props = NativeStackScreenProps<RootStackParamList, 'PublierTrajet'>;

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
  const [pointsInteret, setPointsInteret] = useState<PointInteret[]>([]);
  const [universiteId, setUniversiteId] = useState<string | null>(null);
  const [pointDeRdvId, setPointDeRdvId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [heure, setHeure] = useState('');
  const [places, setPlaces] = useState(4);
  const [prixTotal, setPrixTotal] = useState('');
  const [loadingReferentiel, setLoadingReferentiel] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReferentiel = useCallback(async () => {
    setLoadingReferentiel(true);
    try {
      const [universitesData, pointsData] = await Promise.all([
        listUniversites(),
        listPointsInteret(),
      ]);
      setUniversites(universitesData);
      setPointsInteret(pointsData);
    } finally {
      setLoadingReferentiel(false);
    }
  }, []);

  useEffect(() => {
    void loadReferentiel();
  }, [loadReferentiel]);

  function parseHeureIso(): string | null {
    const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date.trim());
    const heureMatch = /^(\d{2}):(\d{2})$/.exec(heure.trim());
    if (!dateMatch || !heureMatch) return null;

    const [, jj, mm, aaaa] = dateMatch;
    const [, hh, min] = heureMatch;
    const composed = new Date(
      Number(aaaa),
      Number(mm) - 1,
      Number(jj),
      Number(hh),
      Number(min),
    );
    if (Number.isNaN(composed.getTime())) return null;
    return composed.toISOString();
  }

  async function handleSubmit() {
    setError(null);

    if (!universiteId || !pointDeRdvId) {
      setError('Choisis une université et un point de rendez-vous.');
      return;
    }
    const heureIso = parseHeureIso();
    if (!heureIso) {
      setError('Date (JJ/MM/AAAA) ou heure (HH:mm) invalide.');
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
        heure: heureIso,
        places,
        prixTotal: prixNum,
      });
      navigation.navigate('MesTrajetsConducteur');
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
  const pointLabel = pointsInteret.find((p) => p.id === pointDeRdvId)?.nom ?? null;
  const prixNum = parseFloat(prixTotal);
  const prixParPersonne =
    Number.isFinite(prixNum) && prixNum > 0
      ? Math.ceil(prixNum / places)
      : null;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Publier un trajet" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        <PickerField
          label="Point de rendez-vous"
          placeholder="Choisir un point de rendez-vous"
          selectedLabel={pointLabel}
          options={pointsInteret.map((p) => ({ id: p.id, label: p.nom }))}
          onSelect={setPointDeRdvId}
        />
        <PickerField
          label="Université de destination"
          placeholder="Choisir une université"
          selectedLabel={universiteLabel}
          options={universites.map((u) => ({ id: u.id, label: u.nom }))}
          onSelect={setUniversiteId}
        />

        <View style={styles.row}>
          <View style={styles.rowField}>
            <Field label="Date">
              <Input
                placeholder="01/09/2026"
                value={date}
                onChangeText={setDate}
                keyboardType="numbers-and-punctuation"
              />
            </Field>
          </View>
          <View style={styles.rowField}>
            <Field label="Heure">
              <Input
                placeholder="07:00"
                value={heure}
                onChangeText={setHeure}
                keyboardType="numbers-and-punctuation"
              />
            </Field>
          </View>
        </View>

        <Field label="Places">
          <Stepper value={places} onChange={setPlaces} />
        </Field>

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
              pour {places} passagers.
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
