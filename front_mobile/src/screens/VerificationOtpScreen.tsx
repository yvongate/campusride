import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import { requestOtp, verifyOtp } from '../api/client';
import { OTP_LENGTH, isCompleteCode, joinDigits, splitDigits } from '../utils/otp';
import { Button } from '../components/Button';
import { H3, MutedText } from '../components/Typography';

type Props = NativeStackScreenProps<RootStackParamList, 'VerificationOtp'>;

const CODE_LENGTH = OTP_LENGTH;
const RESEND_COOLDOWN_SECONDS = 60;

export default function VerificationOtpScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { phone } = route.params;
  // Aucun SMS reel envoye (pas de fournisseur SMS branche) -- le backend
  // renvoie le code directement, on pre-remplit les cases avec.
  const [digits, setDigits] = useState<string[]>(() =>
    splitDigits(route.params.code),
  );
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function handleDigitChange(index: number, value: string) {
    const clean = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);

    if (clean && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function clearCode() {
    setDigits(Array(CODE_LENGTH).fill(''));
    inputRefs.current[0]?.focus();
  }

  async function handleVerify() {
    if (!isCompleteCode(digits)) return;
    const code = joinDigits(digits);

    setError(null);
    setVerifying(true);
    try {
      const result = await verifyOtp(phone, code);
      await SecureStore.setItemAsync('accessToken', result.accessToken);
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch {
      setError('Code incorrect ou expiré. Réessaie.');
      clearCode();
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError(null);
    try {
      const { code } = await requestOtp(phone);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setDigits(splitDigits(code));
    } catch {
      setError('Impossible de renvoyer le code pour le moment.');
    } finally {
      setResending(false);
    }
  }

  const canVerify = isCompleteCode(digits) && !verifying;

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
          <H3 style={styles.title}>Vérification</H3>
          <MutedText style={styles.subtitle}>
            Code de démonstration pour <Text style={styles.phone}>{phone}</Text> —
            pré-rempli automatiquement (aucun SMS réel n'est envoyé)
          </MutedText>

          <View style={styles.codeRow}>
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                style={[styles.codeInput, digit && styles.codeInputFilled]}
                keyboardType="number-pad"
                maxLength={1}
                value={digit}
                onChangeText={(value) => handleDigitChange(index, value)}
                returnKeyType="done"
              />
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.spacer} />

          {cooldown > 0 ? (
            <MutedText style={styles.resendHint}>
              Renvoyer le code dans{' '}
              <Text style={styles.phone}>00:{String(cooldown).padStart(2, '0')}</Text>
            </MutedText>
          ) : (
            <TouchableOpacity onPress={() => void handleResend()} disabled={resending}>
              <Text style={styles.resendLink}>
                {resending ? 'Envoi…' : 'Renvoyer le code'}
              </Text>
            </TouchableOpacity>
          )}

          <Button
            title="Vérifier"
            block
            loading={verifying}
            disabled={!canVerify}
            onPress={() => void handleVerify()}
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
  phone: {
    fontFamily: fonts.headingSemiBold,
    color: colors.text,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  codeInput: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    textAlign: 'center',
    fontFamily: fonts.headingSemiBold,
    fontSize: 20,
    color: colors.text,
  },
  codeInputFilled: {
    borderColor: colors.accent,
  },
  error: {
    color: colors.accent,
    fontSize: 12.5,
    marginTop: 4,
  },
  spacer: {
    flex: 1,
  },
  resendHint: {
    fontSize: 13,
    marginBottom: 12,
  },
  resendLink: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 13,
    color: colors.accent,
    marginBottom: 12,
  },
});
