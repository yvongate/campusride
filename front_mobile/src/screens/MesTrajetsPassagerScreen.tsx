import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AxiosError } from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabsParamList, RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import {
  annulerReservation,
  listerMesDemandes,
  listerMesReservations,
  MesDemandesDemande,
  MesReservationsTrajet,
  signalerNoShow,
} from '../api/client';
import { getDisplayName } from '../utils/profile';
import { BurgerButton } from '../components/BurgerButton';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { SegmentedControl } from '../components/SegmentedControl';
import { Tag } from '../components/Tag';
import { H4, MutedText } from '../components/Typography';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabsParamList, 'MesTrajetsPassager'>,
  NativeStackScreenProps<RootStackParamList>
>;

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

function statutTag(statut: string) {
  if (statut === 'ouvert') return { variant: 'accent' as const, label: 'Confirmé' };
  if (statut === 'commence') return { variant: 'accent' as const, label: 'En route' };
  if (statut === 'termine') return { variant: 'neutral' as const, label: 'Terminé' };
  return { variant: 'neutral' as const, label: 'Annulé' };
}

function demandeStatutTag(statut: string) {
  if (statut === 'ouverte') {
    return { variant: 'neutral' as const, label: 'En attente de participants' };
  }
  if (statut === 'quota_atteint') {
    return { variant: 'accent' as const, label: "En attente d'un conducteur" };
  }
  if (statut === 'acceptee') {
    return { variant: 'accent' as const, label: 'Conducteur trouvé' };
  }
  if (statut === 'annulee') {
    return { variant: 'neutral' as const, label: 'Annulée' };
  }
  return { variant: 'neutral' as const, label: 'Expirée' };
}

export default function MesTrajetsPassagerScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [trajets, setTrajets] = useState<MesReservationsTrajet[]>([]);
  const [demandes, setDemandes] = useState<MesDemandesDemande[]>([]);
  const [tab, setTab] = useState<'encours' | 'historique' | 'demandes'>('encours');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadTrajets = useCallback(() => {
    setLoading(true);
    setError(null);
    listerMesReservations()
      .then(setTrajets)
      .catch((e) =>
        setError(extractErrorMessage(e, 'Impossible de charger tes trajets.')),
      )
      .finally(() => setLoading(false));
  }, []);

  const loadDemandes = useCallback(() => {
    setLoading(true);
    setError(null);
    listerMesDemandes()
      .then(setDemandes)
      .catch((e) =>
        setError(extractErrorMessage(e, 'Impossible de charger tes demandes.')),
      )
      .finally(() => setLoading(false));
  }, []);

  const loadCurrent = useCallback(() => {
    if (tab === 'demandes') loadDemandes();
    else loadTrajets();
  }, [tab, loadDemandes, loadTrajets]);

  useEffect(() => {
    loadCurrent();
  }, [loadCurrent]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadCurrent);
    return unsubscribe;
  }, [navigation, loadCurrent]);

  async function handleAnnuler(trajetId: string) {
    setPendingId(trajetId);
    setActionError(null);
    try {
      await annulerReservation(trajetId);
      loadTrajets();
    } catch (e) {
      setActionError(extractErrorMessage(e, "L'annulation a échoué."));
    } finally {
      setPendingId(null);
    }
  }

  async function handleSignalerAbsence(trajetId: string) {
    setPendingId(trajetId);
    setActionError(null);
    try {
      await signalerNoShow(trajetId);
      loadTrajets();
    } catch (e) {
      setActionError(extractErrorMessage(e, 'Le signalement a échoué.'));
    } finally {
      setPendingId(null);
    }
  }

  const filtered = trajets.filter((t) =>
    tab === 'encours'
      ? t.statut === 'ouvert' || t.statut === 'commence'
      : t.statut === 'termine' || t.statut === 'annule',
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTitleRow}>
          <H4>Mes trajets</H4>
          <BurgerButton onPress={() => navigation.navigate('Profil')} />
        </View>
        <SegmentedControl
          block
          options={[
            { value: 'encours', label: 'En cours' },
            { value: 'demandes', label: 'Mes demandes' },
            { value: 'historique', label: 'Historique' },
          ]}
          value={tab}
          onChange={(value) => setTab(value as 'encours' | 'historique' | 'demandes')}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.loader} />
      ) : tab === 'demandes' ? (
        <FlatList
          data={demandes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <MutedText style={styles.empty}>
              Tu n'as aucune demande en cours.
            </MutedText>
          }
          renderItem={({ item }) => {
            const tag = demandeStatutTag(item.statut);
            return (
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('PointDeRegroupement', { demandeId: item.id })
                }
              >
                <Card style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle}>
                      {item.commune.nom} → {item.universite.nom}
                    </Text>
                    <Tag variant={tag.variant} label={tag.label} />
                  </View>
                  <MutedText style={styles.cardBody}>
                    {item.placesConfirmees}/{item.placesRecherchees} places ·{' '}
                    {new Date(item.heure).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </MutedText>
                </Card>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <MutedText style={styles.empty}>Aucun trajet ici pour le moment.</MutedText>
            }
            ListFooterComponent={
              tab === 'encours' ? (
                <MutedText style={styles.footNote}>
                  Annulation possible jusqu'à 2h avant le départ. Passé ce délai,
                  l'annulation est bloquée.
                </MutedText>
              ) : null
            }
            renderItem={({ item }) => {
              const conducteurNom = getDisplayName(
                item.conducteur.nom,
                item.conducteur.prenom,
                'Conducteur',
              );
              const passe = new Date(item.heure).getTime() <= Date.now();
              const isPending = pendingId === item.id;
              const tag = statutTag(item.statut);

              return (
                <Card style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle}>
                      {item.pointDeRdv.nom} → {item.universite.nom}
                    </Text>
                    <Tag variant={tag.variant} label={tag.label} />
                  </View>
                  <MutedText style={styles.cardBody}>
                    {conducteurNom} ·{' '}
                    {new Date(item.heure).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </MutedText>

                  <View style={styles.actions}>
                    {item.peutVoirRencontre ? (
                      <Button
                        title="Voir la rencontre"
                        variant="secondary"
                        block
                        onPress={() =>
                          navigation.navigate('Rencontre', { trajetId: item.id })
                        }
                      />
                    ) : null}

                    {item.statut === 'ouvert' || item.statut === 'commence' ? (
                      <Button
                        title="Messagerie"
                        variant="ghost"
                        onPress={() =>
                          navigation.navigate('Messagerie', { trajetId: item.id })
                        }
                      />
                    ) : null}

                    {item.statut === 'termine' ? (
                      <Button
                        title="Noter ce trajet"
                        variant="secondary"
                        block
                        onPress={() =>
                          navigation.navigate('Notation', {
                            trajetId: item.id,
                            cibles: [{ id: item.conducteur.id, label: conducteurNom }],
                          })
                        }
                      />
                    ) : null}

                    {item.statut === 'ouvert' && !passe ? (
                      <Button
                        title="Annuler"
                        variant="ghost"
                        loading={isPending}
                        onPress={() => void handleAnnuler(item.id)}
                      />
                    ) : null}

                    {item.statut === 'ouvert' && passe ? (
                      <Button
                        title="Signaler absence conducteur"
                        variant="ghost"
                        loading={isPending}
                        onPress={() => void handleSignalerAbsence(item.id)}
                      />
                    ) : null}
                  </View>
                </Card>
              );
            }}
          />
        </>
      )}
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
    paddingBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  loader: {
    marginTop: 24,
  },
  list: {
    padding: 20,
    gap: 12,
  },
  card: {
    marginBottom: 0,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 14.5,
    color: colors.text,
  },
  cardBody: {
    fontSize: 13,
  },
  actions: {
    gap: 8,
  },
  empty: {
    textAlign: 'center',
    marginTop: 24,
  },
  footNote: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 8,
  },
  error: {
    color: colors.accent,
    fontSize: 13,
    marginHorizontal: 20,
    marginBottom: 8,
  },
});
