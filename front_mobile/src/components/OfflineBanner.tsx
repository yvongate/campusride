import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { colors, fonts } from '../theme';

// Bandeau global (monte une fois dans App.tsx) qui s'affiche par-dessus
// n'importe quel ecran des que la connexion tombe -- evite que chaque appel
// API echoue silencieusement avec une erreur generique sans que l'utilisateur
// comprenne pourquoi.
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false);
    });
    return unsubscribe;
  }, []);

  if (!offline) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + 6 }]} pointerEvents="none">
      <Text style={styles.text}>Pas de connexion internet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.accent700,
    paddingBottom: 6,
    alignItems: 'center',
    zIndex: 999,
  },
  text: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 12,
    color: colors.background,
  },
});
