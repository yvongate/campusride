import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { useRefreshOnForeground } from '../hooks/useRefreshOnForeground';

// Bandeau local (pas global comme OfflineBanner) -- monte seulement sur les
// ecrans qui utilisent reellement la position (Accueil, CreerDemande),
// jamais sur les ecrans sans rapport (Messagerie, Profil...). Persistant et
// cliquable, contrairement a l'ancien texte rouge ponctuel qui n'apparaissait
// qu'au moment precis d'un echec.
export function LocationBanner() {
  const insets = useSafeAreaInsets();
  const [granted, setGranted] = useState(true);

  const check = useCallback(() => {
    Location.getForegroundPermissionsAsync()
      .then((res) => setGranted(res.status === 'granted'))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  // La permission peut changer pendant que l'app est en arriere-plan
  // (l'utilisateur va dans les reglages) -- on revalide au retour.
  useRefreshOnForeground(check);

  if (granted) return null;

  return (
    <TouchableOpacity
      style={[styles.banner, { paddingTop: insets.top + 6 }]}
      onPress={() => void Linking.openSettings()}
    >
      <Text style={styles.title}>Impossible de vous localiser</Text>
      <Text style={styles.subtitle}>Appuyez ici pour activer la localisation</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.accent700,
    paddingBottom: 8,
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 13,
    color: colors.background,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: colors.background,
    marginTop: 1,
  },
});
