import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import { signalerPassagerAbsent } from '../api/client';
import { getDisplayName } from '../utils/profile';
import { Button } from '../components/Button';
import { RadioRow } from '../components/RadioRow';
import { ScreenFooter } from '../components/ScreenFooter';
import { ScreenHeader } from '../components/ScreenHeader';

type Props = NativeStackScreenProps<RootStackParamList, 'SignalerAbsence'>;

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export default function SignalerAbsenceScreen({ navigation, route }: Props) {
  const { trajetId, passagers } = route.params;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!selectedId) {
      setError('Choisis un passager.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await signalerPassagerAbsent(trajetId, selectedId);
      navigation.goBack();
    } catch (e) {
      setError(extractErrorMessage(e, 'Le signalement a échoué.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Signaler une absence"
        subtitle="Trajet terminé"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {passagers.map((passager) => (
          <RadioRow
            key={passager.id}
            label={getDisplayName(passager.nom, passager.prenom, 'Passager')}
            selected={selectedId === passager.id}
            onPress={() => setSelectedId(passager.id)}
          />
        ))}

        <View style={styles.callout}>
          <Text style={styles.calloutText}>
            La note du passager signalé baissera automatiquement.
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <ScreenFooter>
        <Button
          title="Signaler l'absence"
          block
          loading={submitting}
          disabled={!selectedId}
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 10,
  },
  callout: {
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  calloutText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.accent700,
  },
  error: {
    color: colors.accent,
    fontSize: 13,
  },
});
