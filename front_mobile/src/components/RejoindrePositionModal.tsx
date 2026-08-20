import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import {
  listPointsInteret,
  listQuartiers,
  PointInteret,
  Quartier,
} from '../api/client';
import { Button } from './Button';
import { Field } from './Field';
import { ChevronRightIcon } from './icons';
import { MapPinPicker } from './MapPinPicker';
import { PickerField } from './PickerField';
import { SegmentedControl } from './SegmentedControl';
import { H5, MutedText } from './Typography';

// Meme choix "chez moi / point de repere" que CreerDemandeScreen, mais pour
// rejoindre une demande existante -- avant ce composant, handleRejoindre
// capturait la position GPS silencieusement, sans offrir ce choix (retour
// utilisateur : incoherence avec le flux de creation).
export function RejoindrePositionModal({
  visible,
  communeId,
  submitting,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  communeId: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (lat: number, lng: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const [chezMoi, setChezMoi] = useState(true);
  const [locatingLoading, setLocatingLoading] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [quartiers, setQuartiers] = useState<Quartier[]>([]);
  const [quartierId, setQuartierId] = useState<string | null>(null);
  const [pointsInteret, setPointsInteret] = useState<PointInteret[]>([]);
  const [poiId, setPoiId] = useState<string | null>(null);
  const [poiPosition, setPoiPosition] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [mapPickerOpen, setMapPickerOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    listQuartiers(communeId).then(setQuartiers);
  }, [visible, communeId]);

  useEffect(() => {
    if (!quartierId) {
      setPointsInteret([]);
      setPoiId(null);
      setPoiPosition(null);
      return;
    }
    listPointsInteret(quartierId).then(setPointsInteret);
  }, [quartierId]);

  async function handleUseLocation() {
    setLocatingLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const result = await Location.getCurrentPositionAsync({});
      setPosition({ lat: result.coords.latitude, lng: result.coords.longitude });
    } finally {
      setLocatingLoading(false);
    }
  }

  const selectedPoi = pointsInteret.find((p) => p.id === poiId) ?? null;
  const quartierLabel = quartiers.find((q) => q.id === quartierId)?.nom ?? null;
  const poiLabel = selectedPoi?.nom ?? null;

  const finalPosition = chezMoi
    ? position
    : poiPosition ?? (selectedPoi ? { lat: selectedPoi.latitude, lng: selectedPoi.longitude } : null);
  const canConfirm = Boolean(finalPosition) && !submitting;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 },
        ]}
      >
        <H5>Où seras-tu au départ ?</H5>
        <MutedText style={styles.hint}>
          Ça sert à calculer le point de regroupement de ce trajet.
        </MutedText>

        <View style={styles.segWrap}>
          <SegmentedControl
            options={[
              { value: 'oui', label: 'Chez moi' },
              { value: 'non', label: 'Point de repère' },
            ]}
            value={chezMoi ? 'oui' : 'non'}
            onChange={(value) => setChezMoi(value === 'oui')}
          />
        </View>

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
              label="Quartier"
              placeholder="Choisir un quartier"
              selectedLabel={quartierLabel}
              options={quartiers.map((q) => ({ id: q.id, label: q.nom }))}
              onSelect={setQuartierId}
            />
            <PickerField
              label="Point de repère"
              placeholder={quartierId ? 'Choisir un point de repère' : "Choisis un quartier d'abord"}
              selectedLabel={poiLabel}
              options={pointsInteret.map((p) => ({ id: p.id, label: p.nom }))}
              onSelect={(id) => {
                setPoiId(id);
                setPoiPosition(null);
              }}
              disabled={!quartierId}
            />
            {selectedPoi ? (
              <Field label="Ta position exacte (optionnel)">
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

        <View style={styles.spacer} />

        <Button
          title="Confirmer et rejoindre"
          block
          loading={submitting}
          disabled={!canConfirm}
          onPress={() => finalPosition && onConfirm(finalPosition.lat, finalPosition.lng)}
        />
        <Button title="Annuler" variant="ghost" block onPress={onCancel} />
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
  hint: {
    marginTop: 4,
    marginBottom: 16,
  },
  segWrap: {
    marginBottom: 14,
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
  spacer: {
    flex: 1,
  },
});
