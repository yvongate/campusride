import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AxiosError } from 'axios';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabsParamList, RootStackParamList } from '../navigation/types';
import { colors, fonts, shadows } from '../theme';
import {
  annulerDemande,
  getProfile,
  listCommunes,
  listerDemandes,
  listerMesDemandes,
  listTrajets,
  listUniversites,
  rejoindreDemande,
  Commune,
  Demande,
  MesDemandesDemande,
  Trajet,
  Universite,
} from '../api/client';
import { formatPlacesRestantes } from '../utils/places';
import { getDisplayName } from '../utils/profile';
import { Avatar } from '../components/Avatar';
import { BurgerButton } from '../components/BurgerButton';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ArrowRightIcon, ChevronDownIcon, PlusIcon, StarIcon } from '../components/icons';
import { RejoindrePositionModal } from '../components/RejoindrePositionModal';
import { SegmentedControl } from '../components/SegmentedControl';
import { Tag } from '../components/Tag';
import { H4, H5, MutedText } from '../components/Typography';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabsParamList, 'Accueil'>,
  NativeStackScreenProps<RootStackParamList>
>;

interface PickerOption {
  id: string;
  label: string;
}

// Selecteur "Université / Commune" cote-a-cote de UI_inspo (ecran 4).
function DropdownField({
  label,
  options,
  onSelect,
}: {
  label: string | null;
  placeholder?: string;
  options: PickerOption[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <>
      <TouchableOpacity style={styles.dropdown} onPress={() => setOpen(true)}>
        <Text style={styles.dropdownText} numberOfLines={1}>
          {label ?? 'Choisir…'}
        </Text>
        <ChevronDownIcon color={colors.text} />
      </TouchableOpacity>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View
          style={[
            styles.modalContainer,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom },
          ]}
        >
          <FlatList
            data={options}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  onSelect(item.id);
                  setOpen(false);
                }}
              >
                <Text style={styles.modalItemText}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.modalClose} onPress={() => setOpen(false)}>
            <Text style={styles.modalCloseText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export default function AccueilScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [prenom, setPrenom] = useState<string | null>(null);
  const [universites, setUniversites] = useState<Universite[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [universiteId, setUniversiteId] = useState<string | null>(null);
  const [communeId, setCommuneId] = useState<string | null>(null);
  const [mode, setMode] = useState<'trajets' | 'demandes'>('trajets');
  const [trajets, setTrajets] = useState<Trajet[]>([]);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loadingTrajets, setLoadingTrajets] = useState(false);
  const [loadingDemandes, setLoadingDemandes] = useState(false);
  const [presDeMoi, setPresDeMoi] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [rejoindreError, setRejoindreError] = useState<string | null>(null);
  const [rejoindrePendingId, setRejoindrePendingId] = useState<string | null>(
    null,
  );
  const [joinModalDemandeId, setJoinModalDemandeId] = useState<string | null>(
    null,
  );
  const [mesDemandes, setMesDemandes] = useState<MesDemandesDemande[]>([]);
  const [annulerPendingId, setAnnulerPendingId] = useState<string | null>(null);
  const [annulerError, setAnnulerError] = useState<string | null>(null);

  useEffect(() => {
    getProfile()
      .then((profile) =>
        setPrenom(getDisplayName(null, profile.prenom, profile.telephone)),
      )
      .catch(() => undefined);
  }, []);

  const loadReferentiel = useCallback(async () => {
    const [universitesData, communesData] = await Promise.all([
      listUniversites(),
      listCommunes(),
    ]);
    setUniversites(universitesData);
    setCommunes(communesData);
  }, []);

  useEffect(() => {
    void loadReferentiel();
  }, [loadReferentiel]);

  const loadTrajets = useCallback(
    async (lat?: number, lng?: number) => {
      if (!universiteId || !communeId) return;
      setLoadingTrajets(true);
      try {
        setTrajets(await listTrajets(universiteId, communeId, lat, lng));
      } finally {
        setLoadingTrajets(false);
      }
    },
    [universiteId, communeId],
  );

  useEffect(() => {
    if (mode === 'trajets') void loadTrajets();
  }, [mode, loadTrajets]);

  const loadDemandes = useCallback(async () => {
    if (!universiteId || !communeId) return;
    setLoadingDemandes(true);
    try {
      setDemandes(await listerDemandes(universiteId, communeId));
    } finally {
      setLoadingDemandes(false);
    }
  }, [universiteId, communeId]);

  useEffect(() => {
    if (mode === 'demandes') void loadDemandes();
  }, [mode, loadDemandes]);

  // Independant du filtre universite/commune -- les demandes que j'ai
  // creees/rejointes restent visibles meme si je change de filtre ensuite.
  const loadMesDemandes = useCallback(() => {
    listerMesDemandes()
      .then((data) =>
        setMesDemandes(
          data.filter((d) => d.statut === 'ouverte' || d.statut === 'quota_atteint'),
        ),
      )
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadMesDemandes);
    return unsubscribe;
  }, [navigation, loadMesDemandes]);

  async function handleAnnulerDemande(demandeId: string) {
    setAnnulerPendingId(demandeId);
    setAnnulerError(null);
    try {
      await annulerDemande(demandeId);
      loadMesDemandes();
      if (mode === 'demandes') void loadDemandes();
    } catch (e) {
      setAnnulerError(extractErrorMessage(e, "L'annulation a échoué."));
    } finally {
      setAnnulerPendingId(null);
    }
  }

  function handleRejoindre(demandeId: string) {
    setRejoindreError(null);
    setJoinModalDemandeId(demandeId);
  }

  async function handleConfirmRejoindre(lat: number, lng: number) {
    const demandeId = joinModalDemandeId;
    if (!demandeId) return;
    setRejoindreError(null);
    setRejoindrePendingId(demandeId);
    try {
      await rejoindreDemande(demandeId, lat, lng);
      setJoinModalDemandeId(null);
      navigation.navigate('PointDeRegroupement', { demandeId });
    } catch (e) {
      setRejoindreError(extractErrorMessage(e, "La demande n'a pas pu être rejointe."));
    } finally {
      setRejoindrePendingId(null);
    }
  }

  async function handlePresDeMoiChange(value: string) {
    if (value === 'tous') {
      setPresDeMoi(false);
      setLocationError(null);
      void loadTrajets();
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationError('Autorisation de localisation refusée.');
      return;
    }

    setLocationError(null);
    setPresDeMoi(true);
    const position = await Location.getCurrentPositionAsync({});
    void loadTrajets(position.coords.latitude, position.coords.longitude);
  }

  const universiteLabel = universites.find((u) => u.id === universiteId)?.nom ?? null;
  const communeLabel = communes.find((c) => c.id === communeId)?.nom ?? null;
  const ready = Boolean(universiteId && communeId);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTitleRow}>
          <H4>Salut{prenom ? `, ${prenom}` : ''}</H4>
          <BurgerButton onPress={() => navigation.navigate('Profil')} />
        </View>
        <View style={styles.dropdownRow}>
          <DropdownField
            label={universiteLabel}
            options={universites.map((u) => ({ id: u.id, label: u.nom }))}
            onSelect={setUniversiteId}
          />
          <DropdownField
            label={communeLabel}
            options={communes.map((c) => ({ id: c.id, label: c.nom }))}
            onSelect={setCommuneId}
          />
        </View>
        <MutedText style={styles.caption}>
          Université de destination · Commune de départ
        </MutedText>

        <View style={styles.segRow}>
          <SegmentedControl
            options={[
              { value: 'trajets', label: 'Trajets disponibles' },
              { value: 'demandes', label: 'Créer une demande' },
            ]}
            value={mode}
            onChange={(value) => setMode(value as 'trajets' | 'demandes')}
          />
        </View>
      </View>

      {mode === 'demandes' && mesDemandes.length > 0 ? (
        <View style={styles.mesDemandesSection}>
          <H5>Mes demandes en cours</H5>
          {annulerError ? <Text style={styles.error}>{annulerError}</Text> : null}
          {mesDemandes.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() =>
                navigation.navigate('PointDeRegroupement', { demandeId: item.id })
              }
            >
              <Card style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>
                    {item.commune.nom} → {item.universite.nom}
                  </Text>
                  <Tag
                    variant={item.statut === 'quota_atteint' ? 'accent' : 'neutral'}
                    label={
                      item.statut === 'quota_atteint'
                        ? "En attente d'un conducteur"
                        : 'En attente de participants'
                    }
                  />
                </View>
                <MutedText>
                  {formatPlacesRestantes(item.placesRecherchees, item.placesConfirmees)}
                </MutedText>
                <Button
                  title="Annuler cette demande"
                  variant="ghost"
                  loading={annulerPendingId === item.id}
                  onPress={() => void handleAnnulerDemande(item.id)}
                />
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {ready ? (
        <View style={styles.body}>
          {mode === 'trajets' ? (
            <>
              <View style={styles.segRow}>
                <SegmentedControl
                  options={[
                    { value: 'tous', label: 'Tous les trajets' },
                    { value: 'pres', label: 'Près de moi (POI)' },
                  ]}
                  value={presDeMoi ? 'pres' : 'tous'}
                  onChange={(value) => void handlePresDeMoiChange(value)}
                />
              </View>
              {locationError ? (
                <Text style={styles.error}>{locationError}</Text>
              ) : null}

              {loadingTrajets ? (
                <ActivityIndicator color={colors.accent} style={styles.loader} />
              ) : (
                <FlatList
                  data={trajets}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.list}
                  ListEmptyComponent={
                    <MutedText style={styles.empty}>Aucun trajet pour le moment.</MutedText>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate('TrajetDetail', { trajetId: item.id })
                      }
                    >
                      <Card style={styles.card}>
                        <View style={styles.rowBetween}>
                          <View style={styles.tagRow}>
                            <Tag variant="neutral" label="Conducteur" />
                            {item.conducteur.verifie ? (
                              <Tag variant="outline" label="Vérifié" />
                            ) : null}
                          </View>
                          <Text style={styles.time}>
                            {new Date(item.heure).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                        <View style={styles.titleRow}>
                          <H5
                            style={styles.titleText}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {item.pointDeRdv.nom}
                          </H5>
                          <ArrowRightIcon color={colors.text} />
                          <H5
                            style={styles.titleText}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {item.universite.nom}
                          </H5>
                        </View>
                        <View style={styles.metaRow}>
                          <MutedText style={styles.metaText}>
                            {item.conducteur.nom ?? item.conducteur.prenom ?? 'Conducteur'}
                          </MutedText>
                          {item.conducteur.note !== null ? (
                            <View style={styles.metaInline}>
                              <StarIcon />
                              <MutedText style={styles.metaText}>
                                {item.conducteur.note.toFixed(1)}
                              </MutedText>
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.rowBetween}>
                          <MutedText>{item.places} places</MutedText>
                          <Text style={styles.price}>{item.prixTotal} FCFA</Text>
                        </View>
                        <Button
                          title="Réserver"
                          variant="secondary"
                          block
                          onPress={() =>
                            navigation.navigate('TrajetDetail', { trajetId: item.id })
                          }
                        />
                      </Card>
                    </TouchableOpacity>
                  )}
                />
              )}
            </>
          ) : (
            <>
              {rejoindreError ? (
                <Text style={styles.error}>{rejoindreError}</Text>
              ) : null}

              {loadingDemandes ? (
                <ActivityIndicator color={colors.accent} style={styles.loader} />
              ) : (
                <FlatList
                  data={demandes}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.list}
                  ListHeaderComponent={<H5 style={styles.sectionHeader}>Rejoindre une demande</H5>}
                  ListEmptyComponent={
                    <MutedText style={styles.empty}>Aucune demande pour le moment.</MutedText>
                  }
                  renderItem={({ item }) => {
                    const nom = getDisplayName(item.createur.nom, item.createur.prenom, 'Étudiant');
                    return (
                      <TouchableOpacity
                        onPress={() =>
                          navigation.navigate('PointDeRegroupement', { demandeId: item.id })
                        }
                      >
                        <Card style={styles.card}>
                          <View style={styles.rowBetween}>
                            <Tag variant="accent" label="Demande groupée" />
                            <Text style={styles.time}>
                              {new Date(item.heure).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>
                          </View>
                          <Avatar initial={nom.charAt(0)} size={24} background={colors.accent300} color={colors.text} />
                          <MutedText>
                            {item.placesRestantes > 0
                              ? `${item.placesRestantes} place${item.placesRestantes > 1 ? 's' : ''} restante${item.placesRestantes > 1 ? 's' : ''}`
                              : 'Groupe complet'}{' '}
                            · {item.cotisation} FCFA/pers.
                          </MutedText>
                          {item.dejaRejoint ? (
                            <Button title="Déjà rejoint" variant="secondary" block disabled />
                          ) : (
                            <Button
                              title="Rejoindre"
                              block
                              loading={rejoindrePendingId === item.id}
                              onPress={() => void handleRejoindre(item.id)}
                            />
                          )}
                        </Card>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </>
          )}
        </View>
      ) : (
        <View style={styles.body}>
          <MutedText style={styles.empty}>
            {mode === 'trajets'
              ? 'Choisis ton université et ta commune pour voir les trajets disponibles.'
              : 'Choisis ton université et ta commune pour créer ou rejoindre un trajet.'}
          </MutedText>
        </View>
      )}

      {mode === 'demandes' ? (
        <TouchableOpacity
          style={styles.fab}
          onPress={() =>
            navigation.navigate('CreerDemande', {
              universiteId: universiteId ?? undefined,
              communeId: communeId ?? undefined,
            })
          }
        >
          <PlusIcon />
        </TouchableOpacity>
      ) : null}

      {joinModalDemandeId && communeId ? (
        <RejoindrePositionModal
          visible
          communeId={communeId}
          submitting={rejoindrePendingId === joinModalDemandeId}
          error={rejoindreError}
          onCancel={() => setJoinModalDemandeId(null)}
          onConfirm={(lat, lng) => void handleConfirmRejoindre(lat, lng)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.divider,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dropdownRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  dropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  dropdownText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 13.5,
    color: colors.text,
    flexShrink: 1,
  },
  caption: {
    fontSize: 11,
    marginBottom: 12,
  },
  segRow: {
    marginBottom: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalItemText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  modalClose: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalCloseText: {
    fontFamily: fonts.headingSemiBold,
    color: colors.accent,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    position: 'relative',
  },
  loader: {
    marginTop: 24,
  },
  list: {
    paddingVertical: 16,
    paddingBottom: 80,
    gap: 12,
  },
  sectionHeader: {
    marginBottom: -4,
  },
  card: {
    marginBottom: 0,
  },
  cardTitle: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 14.5,
    color: colors.text,
  },
  mesDemandesSection: {
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
  },
  time: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 13,
    color: colors.text,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
  },
  price: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  empty: {
    textAlign: 'center',
    marginTop: 24,
  },
  error: {
    color: colors.accent,
    fontSize: 13,
    marginBottom: 8,
  },
});
