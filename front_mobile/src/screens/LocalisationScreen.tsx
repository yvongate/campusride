import * as Location from 'expo-location';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme';
import { Button } from '../components/Button';
import { H3, MutedText } from '../components/Typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Localisation'>;

// Ecran de "priming" avant le popup natif iOS -- explique pourquoi l'app
// demande la position avant de la demander, plutot que le popup natif brut
// et sans contexte (voir capture Yango fournie par l'utilisateur). Affiche
// une seule fois, juste apres l'onboarding, avant la connexion.
export default function LocalisationScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  async function handlePartager() {
    await Location.requestForegroundPermissionsAsync();
    // Qu'elle soit accordee ou refusee, la position n'est necessaire que
    // pour des actions ponctuelles plus tard (Pres de moi, position GPS) --
    // pas un blocage pour utiliser l'app.
    navigation.navigate('Connexion');
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.skip, { paddingTop: insets.top + 16 }]}
        onPress={() => navigation.navigate('Connexion')}
      >
        <MutedText style={styles.skipText}>Passer</MutedText>
      </TouchableOpacity>

      <View style={styles.content}>
        <H3 style={styles.title}>Active ta position pour aller plus vite</H3>
        <MutedText style={styles.subtitle}>
          On l'utilise pour te proposer les trajets et demandes les plus
          proches de toi, et affiner ton point de rendez-vous.
        </MutedText>
      </View>

      <View style={[styles.buttonWrap, { paddingBottom: insets.bottom + 24 }]}>
        <Button
          title="Partager ma position"
          block
          onPress={() => void handlePartager()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skip: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    textAlign: 'center',
  },
  buttonWrap: {
    paddingHorizontal: 20,
  },
});
