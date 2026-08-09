import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme';
import { submitConducteurRequest } from '../api/client';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { ScreenFooter } from '../components/ScreenFooter';
import { ScreenHeader } from '../components/ScreenHeader';
import { H6, MutedText } from '../components/Typography';

type Props = NativeStackScreenProps<RootStackParamList, 'InscriptionConducteur'>;

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

export default function InscriptionConducteurScreen({ navigation }: Props) {
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [permisUri, setPermisUri] = useState<string | null>(null);
  const [matricule, setMatricule] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePickSelfie() {
    const uri = await pickPhoto();
    if (uri) setSelfieUri(uri);
  }

  async function handlePickPermis() {
    const uri = await pickPhoto();
    if (uri) setPermisUri(uri);
  }

  async function handleSubmit() {
    if (!selfieUri || !permisUri || !matricule.trim()) {
      setError("Complète les 3 étapes avant d'envoyer ta demande.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await submitConducteurRequest(selfieUri, permisUri, matricule.trim());
      Alert.alert(
        'Demande envoyée',
        'Ta demande sera examinée sous 48h.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response
        ?.status;
      if (status === 409) {
        setError('Tu as déjà une demande en cours.');
      } else {
        setError("Impossible d'envoyer ta demande pour le moment.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Devenir conducteur"
        subtitle="Validation manuelle par l'administrateur sous 48h"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.step}>
          <H6>1. Selfie</H6>
          <TouchableOpacity style={styles.photoSlot} onPress={() => void handlePickSelfie()}>
            {selfieUri ? (
              <Image source={{ uri: selfieUri }} style={styles.photoPreview} />
            ) : (
              <MutedText style={styles.photoPlaceholder}>Prendre un selfie</MutedText>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.step}>
          <H6>2. Permis de conduire</H6>
          <TouchableOpacity style={styles.photoSlot} onPress={() => void handlePickPermis()}>
            {permisUri ? (
              <Image source={{ uri: permisUri }} style={styles.photoPreview} />
            ) : (
              <MutedText style={styles.photoPlaceholder}>
                Prendre une photo du permis
              </MutedText>
            )}
          </TouchableOpacity>
        </View>

        <Field label="3. Matricule du véhicule">
          <Input
            placeholder="CI-2847-AB"
            value={matricule}
            onChangeText={setMatricule}
            autoCapitalize="characters"
          />
        </Field>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <ScreenFooter>
        <Button
          title="Envoyer ma demande"
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
