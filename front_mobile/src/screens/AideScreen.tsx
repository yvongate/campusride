import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { H5, MutedText } from '../components/Typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Aide'>;

const SECTIONS: { titre: string; texte: string }[] = [
  {
    titre: 'Trajet ou demande, quelle différence ?',
    texte:
      "Un trajet est déjà confirmé : un conducteur vérifié a publié son départ, son point de rendez-vous et son prix. Une demande, c'est l'inverse : des étudiants qui vont au même endroit se regroupent d'abord, et un conducteur vient ensuite accepter le groupe.",
  },
  {
    titre: 'Créer une demande',
    texte:
      "Indique ton université, ta commune, l'heure, combien de personnes tu recherches et la cotisation par personne. Si tu es chez toi, ta position GPS est utilisée ; sinon tu choisis un point de repère près de toi.",
  },
  {
    titre: 'Le point de regroupement',
    texte:
      "Quand le groupe est complet, l'app calcule le centre des positions de tout le monde, puis suggère le carrefour ou lieu connu le plus proche de ce centre, dans la même commune. Personne n'a donc à traverser la ville pour rejoindre les autres.",
  },
  {
    titre: '« Près de moi »',
    texte:
      "Sur l'accueil, ce filtre classe les trajets du plus proche au plus éloigné, en comparant ta position à celle du point de rendez-vous de chaque trajet.",
  },
  {
    titre: 'Devenir conducteur',
    texte:
      "Depuis ton profil, envoie un selfie, ton permis de conduire et le matricule de ton véhicule. Un administrateur vérifie le dossier sous 48h. Une fois validé, tu peux publier des trajets et accepter des demandes.",
  },
  {
    titre: 'Annulation',
    texte:
      "Tu peux annuler ta réservation jusqu'à 2h avant le départ. Passé ce délai, l'annulation est bloquée pour ne pas laisser le conducteur et les autres passagers sans solution.",
  },
  {
    titre: 'Absence et signalement',
    texte:
      "Si le conducteur ne vient pas, tu peux le signaler depuis Mes trajets une fois l'heure de départ passée. Le conducteur dispose du même signalement pour un passager absent. Ces signalements sont visibles par l'administration.",
  },
  {
    titre: 'Notes',
    texte:
      "À la fin d'un trajet terminé, passagers et conducteur peuvent se noter de 1 à 5 étoiles. La moyenne s'affiche sur le profil et sur les cartes de trajet.",
  },
  {
    titre: 'Sécurité',
    texte:
      "Aucun trajet n'existe sans un conducteur vérifié par l'administration. Avant de monter, l'écran « Voir la rencontre » te montre le conducteur et le matricule du véhicule pour que tu confirmes que c'est bien la bonne voiture.",
  },
];

export default function AideScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <ScreenHeader title="Aide" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        {SECTIONS.map((section) => (
          <View key={section.titre} style={styles.section}>
            <H5>{section.titre}</H5>
            <MutedText style={styles.body}>{section.texte}</MutedText>
          </View>
        ))}
      </ScrollView>
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
    paddingBottom: 28,
    gap: 20,
  },
  section: {
    gap: 6,
  },
  body: {
    fontSize: 12.5,
    lineHeight: 18.5,
  },
});
