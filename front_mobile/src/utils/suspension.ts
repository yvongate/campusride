import { Alert } from 'react-native';
import { resetToCompteSuspendu } from '../navigation/navigationRef';

// A appeler sur le resultat de toute action pouvant declencher une
// suspension (annulation tardive de reservation, annulation d'une demande
// ayant des participants). Retourne true si le compte vient d'etre suspendu :
// l'appelant DOIT alors s'arreter la, surtout ne pas relancer un chargement,
// dont l'echec brouillerait le message.
export function gererSuspension(suspenduJusqua: string | null): boolean {
  if (!suspenduJusqua) {
    return false;
  }

  const jusqua = new Date(suspenduJusqua).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  Alert.alert(
    'Compte suspendu',
    `C'est ta 2e annulation tardive. Ton compte est suspendu jusqu'au ${jusqua} : tu ne pourras pas utiliser CampusRide d'ici là. Si tu penses que c'est une erreur, tu peux nous écrire depuis l'écran suivant.`,
    [
      {
        text: "J'ai compris",
        // On NE deconnecte PAS : la session reste ouverte pour donner acces au
        // formulaire de recours (le backend laisse passer les routes support
        // meme suspendu). Deconnecter fermait la seule porte de sortie.
        onPress: () => resetToCompteSuspendu(suspenduJusqua),
      },
    ],
  );
  return true;
}
