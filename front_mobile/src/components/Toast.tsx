import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';

type ToastType = 'error' | 'success';

interface ToastEvent {
  message: string;
  type: ToastType;
}

// Singleton imperatif (meme esprit que navigationRef.ts) : n'importe quel
// ecran peut declencher un toast sans passer par un Context/Provider. Un
// seul <ToastHost /> est monte dans App.tsx, comme OfflineBanner.
let listener: ((event: ToastEvent) => void) | null = null;

function emit(message: string, type: ToastType) {
  listener?.({ message, type });
}

export function showError(message: string) {
  emit(message, 'error');
}

export function showSuccess(message: string) {
  emit(message, 'success');
}

const DURATION_MS = 3200;

// Remplace le texte rouge fixe a cote d'un bouton (pattern d'origine, encore
// utilise pour les erreurs de validation de formulaire ou de chargement,
// voir ErrorState) -- reserve aux erreurs d'ACTION (une mutation rejetee
// par le serveur : deja rejoint, complet, etc.), transitoires par nature,
// contrairement a une erreur de champ qui doit rester visible tant qu'elle
// n'est pas corrigee.
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastEvent | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listener = (event) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setToast(event);
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }).start(() => setToast(null));
      }, DURATION_MS);
    };
    return () => {
      listener = null;
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [opacity]);

  if (!toast) return null;

  return (
    <Animated.View
      style={[
        styles.toast,
        toast.type === 'success' ? styles.success : styles.error,
        { bottom: insets.bottom + 24, opacity },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.text}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 13,
    zIndex: 1000,
  },
  error: {
    backgroundColor: colors.text,
  },
  success: {
    backgroundColor: colors.accent700,
  },
  text: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 13,
    color: colors.background,
    textAlign: 'center',
  },
});
