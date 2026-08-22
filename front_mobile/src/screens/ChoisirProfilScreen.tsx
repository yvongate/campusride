import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AxiosError } from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme';
import { declarerChauffeur } from '../api/client';
import { Button } from '../components/Button';
import { showError } from '../components/Toast';
import { H3, MutedText } from '../components/Typography';

type Props = NativeStackScreenProps<RootStackParamList, 'ChoisirProfil'>;

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

// Aiguillage de la premiere connexion. Auparavant, tout le monde atterrissait
// sur la liste des universites, ou "je suis chauffeur" n'etait qu'un bouton
// perdu au milieu -- un conducteur devait comprendre qu'une page intitulee
// "Ton universite" le concernait quand meme. Le choix est desormais pose en
// premier, et chaque profil suit ensuite son propre parcours : l'etudiant
// choisit son universite, le conducteur sa commune.
export default function ChoisirProfilScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState(false);

  async function choisirConducteur() {
    setPending(true);
    try {
      await declarerChauffeur();
      // Pas d'ecran de choix de commune : celle-ci est deduite du GPS sur
      // l'accueil (voir AccueilScreen, nearestCommune), et reste modifiable
      // d'un tap pour aller voir ailleurs. Une etape de plus a l'inscription
      // aurait demande une information que l'app sait deja trouver seule.
      navigation.navigate('Localisation');
    } catch (e) {
      showError(extractErrorMessage(e, "L'enregistrement a échoué."));
    } finally {
      setPending(false);
    }
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.centre}>
        <H3 style={styles.titre}>Tu rejoins CampusRide en tant que…</H3>
        <MutedText style={styles.sous}>
          Ça détermine ce que tu verras sur ton accueil. Tu pourras le changer
          plus tard depuis « Mes informations ».
        </MutedText>

        <View style={styles.actions}>
          <Button
            title="Étudiant"
            block
            disabled={pending}
            onPress={() => navigation.navigate('ChoisirUniversite')}
          />
          <Button
            title="Conducteur"
            variant="secondary"
            block
            loading={pending}
            onPress={() => void choisirConducteur()}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  // Les deux choix occupent le centre de l'ecran : c'est la seule decision a
  // prendre ici, rien ne doit la concurrencer visuellement.
  centre: {
    flex: 1,
    justifyContent: 'center',
  },
  titre: {
    textAlign: 'center',
    marginBottom: 10,
  },
  sous: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 32,
  },
  actions: {
    gap: 12,
  },
});
