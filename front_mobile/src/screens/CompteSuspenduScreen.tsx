import { StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import { Button } from '../components/Button';
import { H3, MutedText } from '../components/Typography';
import { desenregistrerAppareil } from '../utils/push';

type Props = NativeStackScreenProps<RootStackParamList, 'CompteSuspendu'>;

// Ecran-cul-de-sac volontaire : aucun bouton retour, il remplace toute la pile
// (voir resetToCompteSuspendu). La SEULE action possible est d'ecrire au
// support -- une sanction automatique doit toujours avoir un recours.
export default function CompteSuspenduScreen({ navigation, route }: Props) {
  const { suspenduJusqua } = route.params;
  const jusqua = suspenduJusqua
    ? new Date(suspenduJusqua).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const deconnecter = async () => {
    // Avant la suppression du token : la desinscription push est authentifiee.
    await desenregistrerAppareil();
    await SecureStore.deleteItemAsync('accessToken');
    navigation.reset({ index: 0, routes: [{ name: 'Connexion' }] });
  };

  return (
    <View style={styles.container}>
      <View style={styles.contenu}>
        <H3 style={styles.titre}>Compte suspendu</H3>
        <MutedText style={styles.texte}>
          {jusqua
            ? `Suite à une deuxième annulation tardive, ton compte est suspendu jusqu'au ${jusqua}. D'ici là, tu ne peux ni réserver, ni publier, ni rejoindre un trajet.`
            : "Suite à une deuxième annulation tardive, ton compte est suspendu. D'ici là, tu ne peux ni réserver, ni publier, ni rejoindre un trajet."}
        </MutedText>
        <Text style={styles.recours}>
          Si tu penses que c'est une erreur, écris-nous : on relit ton dossier
          et la suspension peut être levée.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button
          title="Contacter le support"
          block
          onPress={() => navigation.navigate('Support')}
        />
        <Button
          title="Se déconnecter"
          variant="ghost"
          block
          onPress={() => void deconnecter()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingBottom: 32,
    justifyContent: 'center',
  },
  contenu: {
    gap: 12,
    marginBottom: 32,
  },
  titre: {
    textAlign: 'center',
  },
  texte: {
    fontSize: 13,
    lineHeight: 19.5,
    textAlign: 'center',
  },
  recours: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19.5,
    textAlign: 'center',
    color: colors.text,
  },
  actions: {
    gap: 10,
  },
});
