import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import { submitVerificationIdentite } from '../api/client';
import { Button } from '../components/Button';
import { ScreenFooter } from '../components/ScreenFooter';
import { ScreenHeader } from '../components/ScreenHeader';
import { H6, MutedText } from '../components/Typography';

type Props = NativeStackScreenProps<RootStackParamList, 'VerificationIdentite'>;

async function pickPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'Permission requise',
      "Autorise l'accès à l'appareil photo pour continuer.",
    );
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });
  if (result.canceled) return null;
  return result.assets[0].uri;
}

export default function VerificationIdentiteScreen({ navigation }: Props) {
  const [cniUri, setCniUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Meme garde-fou que InscriptionConducteurScreen : confirmation avant
  // d'ouvrir l'appareil photo natif (pas toujours un bouton retour visible
  // selon l'appareil) -- jamais de choix depuis la galerie, toujours une
  // vraie prise de vue.
  function confirmerPuisPrendre(label: string, onSuccess: (uri: string) => void) {
    Alert.alert(label, 'Ouvrir l’appareil photo ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Continuer',
        onPress: () => {
          void pickPhoto().then((uri) => {
            if (uri) onSuccess(uri);
          });
        },
      },
    ]);
  }

  function handlePickCni() {
    confirmerPuisPrendre("Carte d'identité", setCniUri);
  }

  function handlePickSelfie() {
    confirmerPuisPrendre('Selfie', setSelfieUri);
  }

  async function handleSubmit() {
    if (!cniUri || !selfieUri) {
      setError('Complète les 2 étapes avant d’envoyer ta vérification.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await submitVerificationIdentite(cniUri, selfieUri);
      Alert.alert(
        'Vérification envoyée',
        'Elle sera examinée sous 48h.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response
        ?.status;
      if (status === 409) {
        setError('Tu as déjà une vérification en cours.');
      } else {
        setError("Impossible d'envoyer ta vérification pour le moment.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Vérification d'identité"
        subtitle="Validation manuelle par l'administrateur sous 48h"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <MutedText>
          Nécessaire pour créer ou rejoindre un trajet, et réutilisée si tu
          deviens conducteur plus tard.
        </MutedText>

        <View style={styles.step}>
          <H6>1. Carte d'identité (CNI)</H6>
          <TouchableOpacity style={styles.photoSlot} onPress={() => void handlePickCni()}>
            {cniUri ? (
              <Image source={{ uri: cniUri }} style={styles.photoPreview} />
            ) : (
              <MutedText style={styles.photoPlaceholder}>
                Prendre une photo de ta CNI
              </MutedText>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.step}>
          <H6>2. Selfie</H6>
          <TouchableOpacity style={styles.photoSlot} onPress={() => void handlePickSelfie()}>
            {selfieUri ? (
              <Image source={{ uri: selfieUri }} style={styles.photoPreview} />
            ) : (
              <MutedText style={styles.photoPlaceholder}>Prendre un selfie</MutedText>
            )}
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <ScreenFooter>
        <Button
          title="Envoyer ma vérification"
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 16,
  },
  step: {
    gap: 8,
  },
  photoSlot: {
    width: '100%',
    height: 140,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    fontSize: 13,
  },
  error: {
    color: colors.accent,
    fontSize: 12.5,
  },
});
