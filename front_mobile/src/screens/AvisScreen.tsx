import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { AxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import { Avis, AvisUtilisateur, listerAvisUtilisateur } from '../api/client';
import { getDisplayName } from '../utils/profile';
import { Card } from '../components/Card';
import { ErrorState } from '../components/ErrorState';
import { ScreenHeader } from '../components/ScreenHeader';
import { MutedText } from '../components/Typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Avis'>;

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function AvisScreen({ navigation, route }: Props) {
  const { userId, nom } = route.params;
  const [data, setData] = useState<AvisUtilisateur | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listerAvisUtilisateur(userId)
      .then(setData)
      .catch((e) =>
        setError(extractErrorMessage(e, 'Impossible de charger les avis.')),
      )
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={`Avis · ${nom}`} onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={`Avis · ${nom}`} onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <ErrorState message={error ?? 'Avis introuvables.'} onRetry={load} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={`Avis · ${nom}`} onBack={() => navigation.goBack()} />

      <View style={styles.summary}>
        <Text style={styles.summaryNote}>
          {data.note !== null ? `★ ${data.note.toFixed(1)}` : '—'}
        </Text>
        <MutedText>
          {data.nombreNotations > 0
            ? `${data.nombreNotations} avis`
            : 'Aucun avis pour le moment'}
        </MutedText>
      </View>

      <FlatList
        data={data.avis}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <MutedText style={styles.empty}>
            Personne n'a encore laissé d'avis.
          </MutedText>
        }
        renderItem={({ item }: { item: Avis }) => (
          <Card style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.auteur}>
                {getDisplayName(
                  item.noteur.nom,
                  item.noteur.prenom,
                  'Étudiant',
                )}
              </Text>
              <Text style={styles.etoiles}>{'★'.repeat(item.etoiles)}</Text>
            </View>
            {item.commentaire ? (
              <Text style={styles.commentaire}>{item.commentaire}</Text>
            ) : null}
            <MutedText style={styles.date}>{formatDate(item.createdAt)}</MutedText>
          </Card>
        )}
      />
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  summaryNote: {
    fontFamily: fonts.heading,
    fontSize: 28,
    color: colors.accent700,
  },
  list: {
    padding: 20,
    gap: 12,
  },
  card: {
    gap: 6,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  auteur: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  etoiles: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.accent,
  },
  commentaire: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: colors.text,
  },
  date: {
    fontSize: 11,
  },
  empty: {
    textAlign: 'center',
    marginTop: 24,
  },
});
