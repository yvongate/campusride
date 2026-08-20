import { ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
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
      "Quand le groupe est complet, l'app calcule le centre des positions de tout le monde, puis suggère le carrefour ou lieu connu le plus proche de ce centre, dans la même commune. Personne n'a donc à traverser la ville pour rejoindre les autres. Si aucun lieu connu n'est assez proche de ce centre, aucun point n'est imposé.",
  },
  {
    titre: 'Le prix',
    texte:
      "Le montant affiché est une cotisation par personne, fixée à l'avance : c'est exactement ce que tu paieras. Il ne bouge pas selon le nombre de passagers qui réservent, ni si quelqu'un annule. Le paiement se fait en espèces au conducteur.",
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
      "Tu peux annuler ta réservation à tout moment jusqu'au départ. Jusqu'à 1h15 avant, ça libère simplement ta place et le trajet continue pour les autres. À moins de 1h15, il est trop tard pour te remplacer : le trajet est annulé pour tout le monde et ça compte comme une annulation tardive. La première passe, à la deuxième ton compte est suspendu trois semaines. Si tu penses qu'une suspension est injustifiée, tu peux nous écrire depuis « Nous contacter » : la sanction peut être levée.",
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
        {/* Sortie de la FAQ : tout ce qu'elle ne couvre pas doit pouvoir
            atterrir chez un humain, sinon l'aide est un cul-de-sac. */}
        <View style={styles.section}>
          <H5>Ta question n'est pas là ?</H5>
          <MutedText style={styles.body}>
            Écris-nous directement, on te répond dans l'app.
          </MutedText>
          <Button
            title="Nous contacter"
            variant="secondary"
            block
            style={styles.contact}
            onPress={() => navigation.navigate('Support')}
          />
        </View>
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
  contact: {
    marginTop: 6,
  },
});
