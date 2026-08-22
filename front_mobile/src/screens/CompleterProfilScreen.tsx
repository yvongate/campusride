import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableWithoutFeedback,
  View,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme';
import { updateNom } from '../api/client';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { H3, MutedText } from '../components/Typography';

type Props = NativeStackScreenProps<RootStackParamList, 'CompleterProfil'>;

// Premiere connexion uniquement (voir VerificationOtpScreen) : le flux OTP
// ne collecte que le telephone, ce court passage demande juste le nom avant
// d'entrer dans l'app -- rien d'autre (pas de CNI/selfie).
export default function CompleterProfilScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [nom, setNom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!nom.trim()) {
      setError('Ton nom est requis.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await updateNom(nom.trim());
      navigation.navigate('ChoisirProfil');
    } catch {
      setError("Impossible d'enregistrer ton nom pour le moment. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View
          style={[
            styles.container,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
          ]}
        >
          <H3 style={styles.title}>Bienvenue !</H3>
          <MutedText style={styles.subtitle}>
            Une dernière étape avant de commencer.
          </MutedText>

          <Field label="Ton nom">
            <Input
              placeholder="Ex. Kouassi"
              value={nom}
              onChangeText={setNom}
              autoCapitalize="words"
              autoFocus
            />
          </Field>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.spacer} />

          <Button
            title="Continuer"
            block
            loading={submitting}
            onPress={() => void handleSubmit()}
          />
          <Button
            title="Passer pour l'instant"
            variant="ghost"
            block
            disabled={submitting}
            onPress={() => navigation.navigate('ChoisirProfil')}
          />
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  title: {
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 28,
  },
  error: {
    color: colors.accent,
    fontSize: 12.5,
    marginTop: 4,
  },
  spacer: {
    flex: 1,
  },
});
