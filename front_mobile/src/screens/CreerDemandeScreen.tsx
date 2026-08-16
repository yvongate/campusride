import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { AxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import {
  creerDemande,
  getProfile,
  listCommunes,
  listPointsInteret,
  listUniversites,
  Commune,
  PointInteret,
  Universite,
} from '../api/client';
import { nearestCommune } from '../utils/nearestCommune';
import { Button } from '../components/Button';
import { DateTimeField } from '../components/DateTimeField';
import { Field, Input } from '../components/Field';
import { ChevronRightIcon } from '../components/icons';
import { LocationBanner } from '../components/LocationBanner';
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
  // Tous les points de repere d'un coup (plus de cascade commune -> quartier
  // -> POI) : recherche libre, la commune/quartier de la demande se deduit
  // ensuite du POI choisi (voir handleSelectPoi) -- le backend ne valide de
  // toute facon aucune coherence entre communeId et le POI (voir
  // DemandesService.creerDemande, "quartier" y est un tag informatif).
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
  const [positionError, setPositionError] = useState<string | null>(null);
  const [dateHeure, setDateHeure] = useState(() => new Date());
  // Un seul chiffre, exprime du point de vue de l'utilisateur : combien de
  // personnes il CHERCHE. Le backend, lui, attend placesRecherchees = total
  // de participants createur inclus (le quota tombe quand
  // participationsConfirmees >= placesRecherchees), d'où le +1 a l'envoi.
  // Deux steppers separes n'apportaient rien : seule leur somme partait.
  // Capacite voiture = 4 passagers max, chauffeur non compris (meme
  // constante que PublierTrajetScreen).
  const PLACES_MAX = 4;
  const [personnesRecherchees, setPersonnesRecherchees] = useState(2);
  const [cotisation, setCotisation] = useState('');
  const [loadingReferentiel, setLoadingReferentiel] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReferentiel = useCallback(async () => {
    setLoadingReferentiel(true);
    try {
      const [universitesData, communesData, pointsInteretData] = await Promise.all([
        listUniversites(),
        listCommunes(),
        listPointsInteret(),
      ]);
      setUniversites(universitesData);
      setCommunes(communesData);
      setPointsInteret(pointsInteretData);
    } finally {
      setLoadingReferentiel(false);
    }
  }, []);

  useEffect(() => {
    void loadReferentiel();
  }, [loadReferentiel]);

  // Repli si l'ecran est ouvert sans parametres (ex. pas depuis le FAB
  // Accueil) : on reutilise l'universite du profil, jamais choisie a la main
  // ici en premier -- voir ChoisirUniversiteScreen.
  useEffect(() => {
    if (route.params?.universiteId) return;
    getProfile()
      .then((profile) => {
        if (profile.universiteId) setUniversiteId(profile.universiteId);
      })
      .catch(() => undefined);
  }, [route.params?.universiteId]);

  function handleSelectPoi(id: string) {
    setPoiId(id);
    setPoiPosition(null);
    // La commune de la demande se deduit du POI choisi -- plus de selection
    // manuelle separee pour ce cas (voir note plus haut sur pointsInteret).
    const poi = pointsInteret.find((p) => p.id === id);
    if (poi) setCommuneId(poi.quartier.commune.id);
  }

  const recupererPosition = useCallback(async () => {
    setLocatingLoading(true);
    setPositionError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPositionError(
          'Autorisation de localisation refusée. Active-la dans les réglages, ou réponds « Non » ci-dessus pour choisir un point de repère.',
        );
        return;
      }
      const result = await Location.getCurrentPositionAsync({});
      setPosition({ lat: result.coords.latitude, lng: result.coords.longitude });
      // Pre-remplit la commune de depart depuis le GPS (devinee via le POI
      // connu le plus proche, voir utils/nearestCommune) au lieu de laisser
      // ce champ vide alors qu'on vient de localiser l'utilisateur -- ne
      // touche pas a un choix deja fait a la main (updater fonctionnel).
      const commune = nearestCommune(
        result.coords.latitude,
        result.coords.longitude,
        pointsInteret,
      );
      if (commune) setCommuneId((current) => current ?? commune.id);
    } catch {
      setPositionError('Impossible de récupérer ta position.');
    } finally {
      setLocatingLoading(false);
    }
  }, [pointsInteret]);

  // L'autorisation est deja accordee a l'inscription (LocalisationScreen) :
  // inutile de faire retaper un bouton, on recupere la position des que
  // l'utilisateur dit etre chez lui. Pas de boucle : en cas d'echec `position`
  // reste null mais aucune dependance ne change, d'ou le bouton "Reessayer".
  useEffect(() => {
    if (!chezMoi || position) return;
    void recupererPosition();
  }, [chezMoi, position, recupererPosition]);

  async function handleSubmit() {
    setError(null);

    if (!universiteId) {
      setError('Choisis ton université.');
      return;
    }
    if (chezMoi) {
      if (!communeId) {
        setError('Choisis ta commune de départ.');
        return;
      }
      if (!position) {
        setError('Récupère ta position avant de continuer.');
        return;
      }
    } else if (!poiId || !communeId) {
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
        placesRecherchees: personnesRecherchees + 1,
        cotisation: cotisationNum,
        chezMoi,
        ...(chezMoi
          ? { lat: position?.lat, lng: position?.lng }
          : {
              poiId: poiId ?? undefined,
              lat: poiPosition?.lat,
              lng: poiPosition?.lng,
            }),
        quartierId: chezMoi ? undefined : selectedPoi?.quartierId,
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
  const selectedPoi = pointsInteret.find((p) => p.id === poiId) ?? null;
  const poiLabel = selectedPoi
    ? `${selectedPoi.nom} (${selectedPoi.quartier.commune.nom})`
    : null;

  return (
    <View style={styles.container}>
      <LocationBanner />
      <ScreenHeader title="Créer une demande" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        <PickerField
          label="Université de destination"
          placeholder="Choisir une université"
          selectedLabel={universiteLabel}
          options={universites.map((u) => ({ id: u.id, label: u.nom, sublabel: u.commune }))}
          onSelect={setUniversiteId}
          searchable
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
            onChange={(value) => {
              // On efface les champs propres a l'autre branche pour ne pas
              // soumettre une commune deduite d'un ancien POI (ou une
              // position GPS perimee) sans que l'utilisateur l'ait choisie
              // pour ce mode-ci.
              setChezMoi(value === 'oui');
              setCommuneId(null);
              setPoiId(null);
              setPoiPosition(null);
              setPosition(null);
            }}
          />
        </View>

        {chezMoi ? (
          <>
            <PickerField
              label="Commune de départ"
              placeholder="Choisir une commune"
              selectedLabel={communeLabel}
              options={communes.map((c) => ({ id: c.id, label: c.nom }))}
              onSelect={setCommuneId}
            />
            <Field label="Ta position">
              {locatingLoading ? (
                <View style={styles.posRow}>
                  <ActivityIndicator color={colors.accent} size="small" />
                  <MutedText style={styles.posText}>Localisation…</MutedText>
                </View>
              ) : position ? (
                <View style={styles.posRow}>
                  <Text style={styles.posOk}>Position récupérée ✓</Text>
                </View>
              ) : (
                <View style={styles.posRetry}>
                  <Text style={styles.error}>
                    {positionError ?? 'Position non disponible.'}
                  </Text>
                  <Button
                    title="Réessayer"
                    variant="secondary"
                    onPress={() => void recupererPosition()}
                  />
                </View>
              )}
            </Field>
          </>
        ) : (
          <>
            <PickerField
              label="Point de repère"
              placeholder="Rechercher un point de repère"
              selectedLabel={poiLabel}
              options={pointsInteret.map((p) => ({
                id: p.id,
                label: p.nom,
                sublabel: `${p.quartier.nom}, ${p.quartier.commune.nom}`,
              }))}
              onSelect={handleSelectPoi}
              searchable
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
          label={`Je recherche ${personnesRecherchees} personne${personnesRecherchees > 1 ? 's' : ''}`}
        >
          <Stepper
            value={personnesRecherchees}
            onChange={setPersonnesRecherchees}
            min={1}
            max={PLACES_MAX - 1}
          />
        </Field>
        <MutedText style={styles.placesHint}>
          Vous serez {personnesRecherchees + 1} dans la voiture, chauffeur non
          compris. Si quelqu'un vient déjà avec toi, compte-le dans ce nombre.
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
  posRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  posText: {
    fontSize: 13,
  },
  posOk: {
    fontFamily: fonts.headingSemiBold,
    color: colors.text,
    fontSize: 13,
  },
  posRetry: {
    gap: 6,
    paddingBottom: 4,
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
