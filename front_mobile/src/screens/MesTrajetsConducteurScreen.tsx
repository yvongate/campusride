import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { AxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import {
  annulerTrajet,
  demarrerTrajet,
  listerMesTrajetsConducteur,
  MesTrajetsConducteurTrajet,
  terminerTrajet,
} from '../api/client';
import { getDisplayName } from '../utils/profile';
import { useRefreshOnForeground } from '../hooks/useRefreshOnForeground';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorState } from '../components/ErrorState';
import { ScreenHeader } from '../components/ScreenHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { Tag } from '../components/Tag';
import { MutedText } from '../components/Typography';

type Props = NativeStackScreenProps<RootStackParamList, 'MesTrajetsConducteur'>;

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export default function MesTrajetsConducteurScreen({ navigation }: Props) {
  const [trajets, setTrajets] = useState<MesTrajetsConducteurTrajet[]>([]);
  const [tab, setTab] = useState<'avenir' | 'termines'>('avenir');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listerMesTrajetsConducteur()
      .then(setTrajets)
      .catch((e) =>
        setError(extractErrorMessage(e, 'Impossible de charger tes trajets.')),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  useRefreshOnForeground(load);

  async function runAction(key: string, action: () => Promise<void>) {
    setPendingKey(key);
    setActionError(null);
    try {
      await action();
      load();
    } catch (e) {
      setActionError(extractErrorMessage(e, "L'action a échoué."));
    } finally {
      setPendingKey(null);
    }
  }

  const filtered = trajets.filter((t) =>
    tab === 'avenir'
      ? t.statut === 'ouvert' || t.statut === 'commence'
      : t.statut === 'termine' || t.statut === 'annule',
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Mes trajets"
        onBack={() => navigation.goBack()}
        right={
          <Button
            title="+ Publier"
            variant="ghost"
            onPress={() => navigation.navigate('PublierTrajet')}
          />
        }
      />

      <View style={styles.segRow}>
        <SegmentedControl
          block
          options={[
            { value: 'avenir', label: 'À venir' },
            { value: 'termines', label: 'Terminés' },
          ]}
          value={tab}
          onChange={(value) => setTab(value as 'avenir' | 'termines')}
        />
      </View>

      {loading && filtered.length === 0 ? (
        <ActivityIndicator color={colors.accent} style={styles.loader} />
      ) : error && filtered.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={load}
                tintColor={colors.accent}
              />
            }
            ListEmptyComponent={
              <MutedText style={styles.empty}>Aucun trajet ici pour le moment.</MutedText>
            }
            renderItem={({ item }) => {
              const demarrerKey = `${item.id}-demarrer`;
              const terminerKey = `${item.id}-terminer`;
              const annulerKey = `${item.id}-annuler`;
              const tag =
                item.statut === 'commence'
                  ? { variant: 'accent' as const, label: 'En route' }
                  : item.statut === 'ouvert'
                    ? { variant: 'neutral' as const, label: 'À confirmer' }
                    : item.statut === 'termine'
                      ? { variant: 'neutral' as const, label: 'Terminé' }
                      : { variant: 'neutral' as const, label: 'Annulé' };

              return (
                <Card style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle}>
                      {item.pointDeRdv.nom} → {item.universite.nom}
                    </Text>
                    <Tag variant={tag.variant} label={tag.label} />
                  </View>
                  <MutedText style={styles.cardBody}>
                    {new Date(item.heure).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · {item.places - item.placesDisponibles} passagers
                    {item.statut === 'commence' ? ' · Trajet commencé' : ''}
                  </MutedText>

                  {item.statut === 'ouvert' ? (
                    <View style={styles.actionsRow}>
                      <View style={styles.actionsFlex}>
                        <Button
                          title="Confirmer le départ"
                          loading={pendingKey === demarrerKey}
                          onPress={() =>
                            void runAction(demarrerKey, () => demarrerTrajet(item.id))
                          }
                        />
                      </View>
                      <View style={styles.actionsFlex}>
                        <Button
                          title="Annuler"
                          variant="secondary"
                          loading={pendingKey === annulerKey}
                          onPress={() =>
                            void runAction(annulerKey, () => annulerTrajet(item.id))
                          }
                        />
                      </View>
                    </View>
                  ) : null}

                  {item.statut === 'commence' ? (
                    <>
                      <Button
                        title="Marquer comme terminé"
                        block
                        loading={pendingKey === terminerKey}
                        onPress={() =>
                          void runAction(terminerKey, () => terminerTrajet(item.id))
                        }
                      />
                      <MutedText style={styles.noteText}>
                        Annulation impossible — le trajet a déjà commencé.
                      </MutedText>
                    </>
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

                  {item.statut === 'termine' && item.passagers.length > 0 ? (
                    <View style={styles.termineActions}>
                      {item.passagers.map((passager) => (
                        <Button
                          key={passager.id}
                          title={`Noter ${getDisplayName(passager.nom, passager.prenom, 'Passager')}`}
                          variant="ghost"
                          onPress={() =>
                            navigation.navigate('Notation', {
                              trajetId: item.id,
                              cibles: [
                                {
                                  id: passager.id,
                                  label: getDisplayName(passager.nom, passager.prenom, 'Passager'),
                                },
                              ],
                            })
                          }
                        />
                      ))}
                      <Button
                        title="Signaler une absence"
                        variant="secondary"
                        block
                        onPress={() =>
                          navigation.navigate('SignalerAbsence', {
                            trajetId: item.id,
                            passagers: item.passagers,
                          })
                        }
                      />
                    </View>
                  ) : null}
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
  segRow: {
    paddingHorizontal: 20,
    paddingBottom: 12,
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
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionsFlex: {
    flex: 1,
  },
  noteText: {
    fontSize: 11,
  },
  termineActions: {
    gap: 8,
    marginTop: 4,
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
