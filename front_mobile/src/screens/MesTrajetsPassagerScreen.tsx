import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
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
import { gererSuspension } from '../utils/suspension';
import { formatPlacesRestantes } from '../utils/places';
import { getDisplayName } from '../utils/profile';
import { useRefreshOnForeground } from '../hooks/useRefreshOnForeground';
import { BurgerButton } from '../components/BurgerButton';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorState } from '../components/ErrorState';
import { showError } from '../components/Toast';
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

// Statuts "actifs" (onglet En cours) vs "clos" (onglet Historique) -- une
// demande non resolue est aussi "en cours" au meme titre qu'un trajet
// reserve, avoir un 3e onglet separe pour les demandes pretait a confusion
// (retour utilisateur direct, meme raisonnement que la fusion faite sur
// l'Accueil).
const DEMANDE_STATUTS_EN_COURS = ['ouverte', 'quota_atteint', 'acceptee'];

// Meme fenetre que PASSENGER_CANCELLATION_DEADLINE_MS cote backend
// (TrajetsService.annulerReservation) -- sert a avertir avant confirmation,
// plus a cacher le bouton : annuler en dessous de ce delai n'est plus
// bloque, mais annule le trajet pour tout le monde et compte comme une
// annulation tardive (suspension du compte a partir de la 2e).
const ANNULATION_TARDIVE_MS = 75 * 60 * 1000;

export default function MesTrajetsPassagerScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const [trajets, setTrajets] = useState<MesReservationsTrajet[]>([]);
  const [demandes, setDemandes] = useState<MesDemandesDemande[]>([]);
  // Ouvrable directement sur l'historique depuis le menu Profil.
  const tabDemande = route.params?.tab;
  const [tab, setTab] = useState<'encours' | 'historique'>(
    tabDemande ?? 'encours',
  );

  useEffect(() => {
    if (tabDemande) setTab(tabDemande);
  }, [tabDemande]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadAll = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([listerMesReservations(), listerMesDemandes()])
      .then(([trajetsData, demandesData]) => {
        setTrajets(trajetsData);
        setDemandes(demandesData);
      })
      .catch((e) =>
        setError(extractErrorMessage(e, 'Impossible de charger tes trajets.')),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadAll);
    return unsubscribe;
  }, [navigation, loadAll]);

  useRefreshOnForeground(loadAll);

  async function handleAnnuler(trajetId: string) {
    setPendingId(trajetId);
    try {
      const resultat = await annulerReservation(trajetId);

      // Suspension declenchee par cette annulation : gererSuspension explique
      // puis deconnecte volontairement. Surtout ne pas enchainer sur
      // loadAll(), dont le 401 deconnecterait sans la moindre explication.
      if (gererSuspension(resultat.suspenduJusqua)) {
        return;
      }

      if (resultat.trajetAnnule) {
        showError(
          'Annulation tardive : le trajet a été annulé pour tout le monde.',
        );
      }
      loadAll();
    } catch (e) {
      showError(extractErrorMessage(e, "L'annulation a échoué."));
    } finally {
      setPendingId(null);
    }
  }

  // Annuler reste toujours possible (bloquer ne fait qu'encourager le
  // no-show silencieux), mais a moins de 1h15 du depart ca annule le trajet
  // pour tout le monde -- un avertissement explicite avant confirmation
  // evite la mauvaise surprise, la sanction (suspension a partir de la 2e
  // annulation tardive) n'est sinon visible qu'apres coup.
  function handleAnnulerPress(trajetId: string, tardive: boolean) {
    if (!tardive) {
      void handleAnnuler(trajetId);
      return;
    }
    Alert.alert(
      'Annulation tardive',
      "À moins de 1h15 du départ, annuler ta réservation annule le trajet pour tout le monde. Ça compte comme une annulation tardive : à la 2e, ton compte est suspendu trois semaines.",
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: 'Annuler quand même',
          style: 'destructive',
          onPress: () => void handleAnnuler(trajetId),
        },
      ],
    );
  }

  async function handleSignalerAbsence(trajetId: string) {
    setPendingId(trajetId);
    try {
      await signalerNoShow(trajetId);
      loadAll();
    } catch (e) {
      showError(extractErrorMessage(e, 'Le signalement a échoué.'));
    } finally {
      setPendingId(null);
    }
  }

  type FeedItem =
    | { kind: 'trajet'; id: string; heure: string; trajet: MesReservationsTrajet }
    | { kind: 'demande'; id: string; heure: string; demande: MesDemandesDemande };

  const feed = useMemo<FeedItem[]>(() => {
    const trajetsFiltres = trajets.filter((t) =>
      tab === 'encours'
        ? t.statut === 'ouvert' || t.statut === 'commence'
        : t.statut === 'termine' || t.statut === 'annule',
    );
    const demandesFiltrees = demandes.filter((d) =>
      tab === 'encours'
        ? DEMANDE_STATUTS_EN_COURS.includes(d.statut)
        : !DEMANDE_STATUTS_EN_COURS.includes(d.statut),
    );
    const items: FeedItem[] = [
      ...trajetsFiltres.map((t) => ({
        kind: 'trajet' as const,
        id: `t-${t.id}`,
        heure: t.heure,
        trajet: t,
      })),
      ...demandesFiltrees.map((d) => ({
        kind: 'demande' as const,
        id: `d-${d.id}`,
        heure: d.heure,
        demande: d,
      })),
    ];
    items.sort((a, b) => new Date(a.heure).getTime() - new Date(b.heure).getTime());
    return items;
  }, [trajets, demandes, tab]);

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
            { value: 'historique', label: 'Historique' },
          ]}
          value={tab}
          onChange={(value) => setTab(value as 'encours' | 'historique')}
        />
      </View>

      {loading && feed.length === 0 ? (
        <ActivityIndicator color={colors.accent} style={styles.loader} />
      ) : error && feed.length === 0 ? (
        <ErrorState message={error} onRetry={loadAll} />
      ) : (
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <FlatList
            data={feed}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={loadAll}
                tintColor={colors.accent}
              />
            }
            ListEmptyComponent={
              <MutedText style={styles.empty}>Rien ici pour le moment.</MutedText>
            }
            ListFooterComponent={
              tab === 'encours' ? (
                <MutedText style={styles.footNote}>
                  Annulation possible jusqu'au départ. À moins de 1h15, ça
                  annule le trajet pour tout le monde et compte comme une
                  annulation tardive (suspension du compte à la 2e).
                </MutedText>
              ) : null
            }
            renderItem={({ item }) =>
              item.kind === 'demande' ? (
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('PointDeRegroupement', {
                      demandeId: item.demande.id,
                    })
                  }
                >
                  <Card style={styles.card}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.cardTitle}>
                        {item.demande.commune.nom} → {item.demande.universite.nom}
                      </Text>
                      <Tag {...demandeStatutTag(item.demande.statut)} />
                    </View>
                    <MutedText style={styles.cardBody}>
                      {formatPlacesRestantes(
                        item.demande.placesRecherchees,
                        item.demande.placesConfirmees,
                      )}{' '}
                      ·{' '}
                      {new Date(item.demande.heure).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </MutedText>
                  </Card>
                </TouchableOpacity>
              ) : (
                (() => {
                  const t = item.trajet;
                  const conducteurNom = getDisplayName(
                    t.conducteur.nom,
                    t.conducteur.prenom,
                    'Conducteur',
                  );
                  const passe = new Date(t.heure).getTime() <= Date.now();
                  const annulationTardive =
                    new Date(t.heure).getTime() - Date.now() < ANNULATION_TARDIVE_MS;
                  const isPending = pendingId === t.id;
                  const tag = statutTag(t.statut);

                  return (
                    <Card style={styles.card}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.cardTitle}>
                          {t.pointDeRdv.nom} → {t.universite.nom}
                        </Text>
                        <Tag variant={tag.variant} label={tag.label} />
                      </View>
                      <MutedText style={styles.cardBody}>
                        {conducteurNom} ·{' '}
                        {new Date(t.heure).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </MutedText>

                      <View style={styles.actions}>
                        {t.peutVoirRencontre ? (
                          <Button
                            title="Voir la rencontre"
                            variant="secondary"
                            block
                            onPress={() =>
                              navigation.navigate('Rencontre', { trajetId: t.id })
                            }
                          />
                        ) : null}

                        {t.statut === 'ouvert' || t.statut === 'commence' ? (
                          <Button
                            title="Messagerie"
                            variant="ghost"
                            onPress={() =>
                              navigation.navigate('Messagerie', { trajetId: t.id })
                            }
                          />
                        ) : null}

                        {t.statut === 'termine' ? (
                          <Button
                            title="Noter ce trajet"
                            variant="secondary"
                            block
                            onPress={() =>
                              navigation.navigate('Notation', {
                                trajetId: t.id,
                                cibles: [{ id: t.conducteur.id, label: conducteurNom }],
                              })
                            }
                          />
                        ) : null}

                        {t.statut === 'ouvert' && !passe ? (
                          <Button
                            title="Annuler"
                            variant="ghost"
                            loading={isPending}
                            onPress={() => handleAnnulerPress(t.id, annulationTardive)}
                          />
                        ) : null}

                        {t.statut === 'ouvert' && passe ? (
                          <Button
                            title="Signaler absence conducteur"
                            variant="ghost"
                            loading={isPending}
                            onPress={() => void handleSignalerAbsence(t.id)}
                          />
                        ) : null}
                      </View>
                    </Card>
                  );
                })()
              )
            }
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
