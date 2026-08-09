import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import {
  getProfile,
  listerNotationsTrajet,
  noterParticipant,
} from '../api/client';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Field, Input } from '../components/Field';
import { ScreenHeader } from '../components/ScreenHeader';
import { H5, MutedText } from '../components/Typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Notation'>;

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export default function NotationScreen({ navigation, route }: Props) {
  const { trajetId, cibles } = route.params;
  const [loading, setLoading] = useState(true);
  const [deja, setDeja] = useState<Set<string>>(new Set());
  const [etoiles, setEtoiles] = useState<Record<string, number>>({});
  const [commentaires, setCommentaires] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profile, notations] = await Promise.all([
        getProfile(),
        listerNotationsTrajet(trajetId),
      ]);
      setDeja(
        new Set(
          notations
            .filter((n) => n.noteurId === profile.id)
            .map((n) => n.destinataireId),
        ),
      );
    } catch (e) {
      setError(extractErrorMessage(e, 'Impossible de charger les notations.'));
    } finally {
      setLoading(false);
    }
  }, [trajetId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleNoter(cibleId: string) {
    const note = etoiles[cibleId] ?? 0;
    if (note < 1) {
      setError('Choisis une note de 1 à 5 étoiles.');
      return;
    }
    setPendingId(cibleId);
    setError(null);
    try {
      await noterParticipant(
        trajetId,
        cibleId,
        note,
        commentaires[cibleId]?.trim() || undefined,
      );
      setDeja((prev) => new Set(prev).add(cibleId));
    } catch (e) {
      setError(extractErrorMessage(e, "L'envoi de la note a échoué."));
    } finally {
      setPendingId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Noter le trajet" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {cibles.map((cible) => {
          const noteActuelle = etoiles[cible.id] ?? 0;
          const isDeja = deja.has(cible.id);

          return (
            <Card key={cible.id} style={styles.card}>
              <H5>{cible.label}</H5>

              {isDeja ? (
                <MutedText>Déjà noté, merci !</MutedText>
              ) : (
                <>
                  <View style={styles.stars}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <TouchableOpacity
                        key={n}
                        onPress={() =>
                          setEtoiles((prev) => ({ ...prev, [cible.id]: n }))
                        }
                      >
                        <Text
                          style={[
                            styles.star,
                            n <= noteActuelle && styles.starActive,
                          ]}
                        >
                          ★
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Field label="Commentaire (optionnel)">
                    <Input
                      value={commentaires[cible.id] ?? ''}
                      onChangeText={(text) =>
                        setCommentaires((prev) => ({ ...prev, [cible.id]: text }))
                      }
                      multiline
                    />
                  </Field>

                  <Button
                    title="Envoyer la note"
                    loading={pendingId === cible.id}
                    onPress={() => void handleNoter(cible.id)}
                  />
                </>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 16,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    gap: 10,
  },
  stars: {
    flexDirection: 'row',
    gap: 6,
  },
  star: {
    fontFamily: fonts.body,
    fontSize: 28,
    color: colors.divider,
  },
  starActive: {
    color: colors.accent,
  },
  error: {
    color: colors.accent,
    fontSize: 13,
  },
});
