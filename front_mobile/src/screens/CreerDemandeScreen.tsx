import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { AxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import {
  creerDemande,
  listCommunes,
  listPointsInteret,
  listQuartiers,
  listUniversites,
  Commune,
  PointInteret,
  Quartier,
  Universite,
} from '../api/client';
import { Button } from '../components/Button';
import { DateTimeField } from '../components/DateTimeField';
import { Field, Input } from '../components/Field';
import { ChevronRightIcon } from '../components/icons';
import { MapPinPicker } from '../components/MapPinPicker';
import { PickerField } from '../components/PickerField';
import { ScreenFooter } from '../components/ScreenFooter';
import { ScreenHeader } from '../components/ScreenHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { Stepper } from '../components/Stepper';
import { MutedText } from '../components/Typography';

type Props = NativeStackScreenProps<RootStackParamList, 'CreerDemande'>;

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

export default function CreerDemandeScreen({ navigation, route }: Props) {
  const [universites, setUniversites] = useState<Universite[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [quartiers, setQuartiers] = useState<Quartier[]>([]);
  const [pointsInteret, setPointsInteret] = useState<PointInteret[]>([]);
  // Pre-rempli avec les filtres deja choisis sur l'ecran Accueil (memes
  // valeurs que listerDemandes y utilisera au retour) pour eviter qu'une
  // demande creee ici avec une autre universite/commune ne "disparaisse"
  // de la liste Accueil faute de correspondre au filtre actif.
  const [universiteId, setUniversiteId] = useState<string | null>(
    route.params?.universiteId ?? null,
  );
  const [communeId, setCommuneId] = useState<string | null>(
    route.params?.communeId ?? null,
  );
  const [quartierId, setQuartierId] = useState<string | null>(null);
  const [poiId, setPoiId] = useState<string | null>(null);
  const [poiPosition, setPoiPosition] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [chezMoi, setChezMoi] = useState(true);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locatingLoading, setLocatingLoading] = useState(false);
  const [dateHeure, setDateHeure] = useState(() => new Date());
  // Nombre d'AUTRES personnes recherchees (le createur compte deja pour 1) --
  // envoye au backend comme placesRecherchees = autresPersonnes + 1, car le
  // backend compte le groupe total (createur inclus). Max 3 => 4 passagers
  // au total dans la voiture (sans compter le chauffeur).
  const [autresPersonnes, setAutresPersonnes] = useState(2);
  const [cotisation, setCotisation] = useState('');
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
    if (chezMoi || !quartierId) {
      setPointsInteret([]);
      setPoiId(null);
      setPoiPosition(null);
      return;
    }
    listPointsInteret(quartierId).then(setPointsInteret);
  }, [chezMoi, quartierId]);

  function handleSelectPoi(id: string) {
    setPoiId(id);
    setPoiPosition(null);
  }

  async function handleUseLocation() {
    setLocatingLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Autorisation de localisation refusée.');
        return;
      }
      const result = await Location.getCurrentPositionAsync({});
      setPosition({ lat: result.coords.latitude, lng: result.coords.longitude });
    } finally {
      setLocatingLoading(false);
    }
  }

  async function handleSubmit() {
    setError(null);

    if (!universiteId || !communeId) {
      setError('Choisis ton université et ta commune.');
      return;
    }
    if (chezMoi && !position) {
      setError('Récupère ta position avant de continuer.');
      return;
    }
    if (!chezMoi && !poiId) {
      setError('Choisis un point de repère.');
      return;
    }
    const cotisationNum = parseFloat(cotisation);
    if (!Number.isFinite(cotisationNum) || cotisationNum < 1) {
      setError('Cotisation invalide.');
      return;
    }

    setSubmitting(true);
    try {
      const demande = await creerDemande({
        universiteId,
        communeId,
        heure: dateHeure.toISOString(),
        // +1 : le backend compte le groupe total (createur inclus).
        placesRecherchees: autresPersonnes + 1,
        cotisation: cotisationNum,
        chezMoi,
        ...(chezMoi
          ? { lat: position?.lat, lng: position?.lng }
          : {
              poiId: poiId ?? undefined,
              lat: poiPosition?.lat,
              lng: poiPosition?.lng,
            }),
        quartierId: quartierId ?? undefined,
      });
      navigation.replace('PointDeRegroupement', { demandeId: demande.id });
    } catch (e) {
      setError(extractErrorMessage(e, 'La création de la demande a échoué.'));
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
  const selectedPoi = pointsInteret.find((p) => p.id === poiId) ?? null;
  const poiLabel = selectedPoi?.nom ?? null;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Créer une demande" onBack={() => navigation.goBack()} />

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

        <View style={styles.locRow}>
          <View style={styles.locLabel}>
            <Text style={styles.locLabelText}>Je suis chez moi actuellement</Text>
            <MutedText style={styles.locLabelSub}>Utilise ma position GPS</MutedText>
          </View>
          <SegmentedControl
            options={[
              { value: 'oui', label: 'Oui' },
              { value: 'non', label: 'Non' },
            ]}
            value={chezMoi ? 'oui' : 'non'}
            onChange={(value) => setChezMoi(value === 'oui')}
          />
        </View>

        <PickerField
          label="Quartier (optionnel)"
          placeholder="Choisir un quartier"
          selectedLabel={quartierLabel}
          options={quartiers.map((q) => ({ id: q.id, label: q.nom }))}
          onSelect={setQuartierId}
        />

        {chezMoi ? (
          <Field label="Position">
            <TouchableOpacity
              style={styles.locationButton}
              onPress={() => void handleUseLocation()}
              disabled={locatingLoading}
            >
              <Text style={styles.locationButtonText}>
                {locatingLoading
                  ? 'Localisation...'
                  : position
                    ? 'Position récupérée ✓'
                    : 'Utiliser ma position GPS'}
              </Text>
            </TouchableOpacity>
          </Field>
        ) : (
          <>
            <PickerField
              label="Point de repère"
              placeholder={quartierId ? 'Choisir un point de repère' : "Choisis un quartier d'abord"}
              selectedLabel={poiLabel}
              options={pointsInteret.map((p) => ({ id: p.id, label: p.nom }))}
              onSelect={handleSelectPoi}
              disabled={!quartierId}
            />
            {selectedPoi ? (
              <Field label="Ta position de départ exacte (optionnel)">
                <TouchableOpacity
                  style={styles.refineButton}
                  onPress={() => setMapPickerOpen(true)}
                >
                  <Text style={styles.refineButtonText}>
                    {poiPosition
                      ? 'Position indiquée ✓ — toucher pour modifier'
                      : 'Toucher pour indiquer ma position sur la carte'}
                  </Text>
                  <ChevronRightIcon color={colors.accent} />
                </TouchableOpacity>
              </Field>
            ) : null}
            {selectedPoi ? (
              <MapPinPicker
                visible={mapPickerOpen}
                initialLat={poiPosition?.lat ?? selectedPoi.latitude}
                initialLng={poiPosition?.lng ?? selectedPoi.longitude}
                onConfirm={(lat, lng) => {
                  setPoiPosition({ lat, lng });
                  setMapPickerOpen(false);
                }}
                onClose={() => setMapPickerOpen(false)}
              />
            ) : null}
          </>
        )}

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

        <Field
          label={`Je recherche ${autresPersonnes} personne${autresPersonnes > 1 ? 's' : ''}`}
        >
          <Stepper value={autresPersonnes} onChange={setAutresPersonnes} max={3} />
        </Field>
        <MutedText style={styles.placesHint}>
          Toi + {autresPersonnes} = {autresPersonnes + 1} personnes dans la voiture (chauffeur non compris).
        </MutedText>

        <Field label="Cotisation par personne">
          <Input
            placeholder="2 500 FCFA"
            value={cotisation}
            onChangeText={setCotisation}
            keyboardType="number-pad"
          />
        </Field>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <ScreenFooter>
        <Button
          title="Publier la demande"
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
    gap: 2,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  locLabel: {
    flex: 1,
    paddingRight: 12,
  },
  locLabelText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  locLabelSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  locationButton: {
    minHeight: 36,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationButtonText: {
    fontFamily: fonts.headingSemiBold,
    color: colors.text,
    fontSize: 13,
  },
  refineButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  refineButtonText: {
    flexShrink: 1,
    fontFamily: fonts.headingSemiBold,
    color: colors.accent,
    fontSize: 12.5,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowField: {
    flex: 1,
  },
  placesHint: {
    fontSize: 11.5,
    marginTop: -6,
    marginBottom: 14,
  },
  error: {
    color: colors.accent,
    fontSize: 13,
    marginBottom: 12,
  },
});
