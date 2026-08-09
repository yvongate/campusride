import { useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import { isValidLocalPhone, toE164 } from '../utils/phone';
import { requestOtp } from '../api/client';
import { Button } from '../components/Button';
import { H3, MutedText } from '../components/Typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Connexion'>;

export default function ConnexionScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [localNumber, setLocalNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);

    if (!isValidLocalPhone(localNumber)) {
      setError('Numéro invalide. Saisis les 10 chiffres de ton numéro.');
      return;
    }

    setLoading(true);
    try {
      const phone = toE164(localNumber);
      const { code } = await requestOtp(phone);
      navigation.navigate('VerificationOtp', { phone, code });
    } catch {
      setError("Impossible d'envoyer le code pour le moment. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
            <View style={styles.logoWrap}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <H3 style={styles.brand}>CampusRide</H3>
            <Text style={styles.tagline}>
              Le covoiturage étudiant d'Abidjan. Trouve ton trajet vers le
              campus, sans attente.
            </Text>
          </View>

          <View style={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
            <MutedText style={styles.label}>Numéro de téléphone</MutedText>
            <View style={styles.inputRow}>
              <Text style={styles.prefix}>+225</Text>
              <View style={styles.separator} />
              <TextInput
                style={styles.input}
                placeholder="07 00 00 00 00"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={10}
                value={localNumber}
                onChangeText={(text) => setLocalNumber(text.replace(/\D/g, ''))}
                onSubmitEditing={Keyboard.dismiss}
              />
              {isValidLocalPhone(localNumber) ? (
                <Text style={styles.checkmark}>✓</Text>
              ) : null}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.spacer} />

            <Button
              title="Recevoir le code"
              block
              loading={loading}
              onPress={() => void handleSubmit()}
            />

            <MutedText style={styles.terms}>
              En continuant, tu acceptes les conditions d'utilisation de
              CampusRide.
            </MutedText>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: colors.text,
    paddingBottom: 36,
    paddingHorizontal: 24,
  },
  logoWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  brand: {
    color: colors.background,
    marginBottom: 10,
  },
  tagline: {
    fontFamily: fonts.body,
    color: 'rgba(243,242,242,0.78)',
    fontSize: 14,
  },
  body: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
  },
  label: {
    fontSize: 12,
    marginBottom: 5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 36,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  prefix: {
    fontFamily: fonts.headingSemiBold,
    color: colors.text,
  },
  separator: {
    width: 1,
    height: 16,
    backgroundColor: colors.divider,
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    color: colors.text,
    paddingVertical: 8,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a9e5c',
  },
  error: {
    color: colors.accent,
    fontSize: 12.5,
    marginTop: 8,
  },
  spacer: {
    flex: 1,
  },
  terms: {
    fontSize: 11.5,
    marginTop: 14,
  },
});
