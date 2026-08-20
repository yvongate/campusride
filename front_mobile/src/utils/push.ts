import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { enregistrerAppareilPush, supprimerAppareilPush } from '../api/client';
import { navigationRef } from '../navigation/navigationRef';

// Meme forme que NotificationData cote backend (notifications.service.ts).
interface NotificationData {
  type?:
    | 'demande'
    | 'trajet'
    | 'messagerie'
    | 'notation'
    | 'compte'
    | 'support';
  id?: string;
}

const CANAL_ANDROID = 'campusride-defaut';

// Le token est conserve localement uniquement pour pouvoir le desinscrire a
// la deconnexion : a ce moment-la, le re-demander a Expo echouerait si la
// permission a ete revoquee entre-temps.
const CLE_TOKEN_PUSH = 'expoPushToken';

// Notification recue alors que l'app est au premier plan : par defaut elle
// serait silencieusement ignoree. On l'affiche quand meme -- un message de
// chat ou une annulation de trajet doit se voir immediatement.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function lireProjectId(): string | undefined {
  // getExpoPushTokenAsync a besoin du projectId ; il est injecte par EAS dans
  // extra.eas.projectId (voir `eas init`). Absent tant que le projet n'a pas
  // ete lie a EAS -- d'ou la lecture defensive plutot qu'un acces direct.
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

// Recupere le token Expo de cet appareil et l'envoie au backend. Renvoie le
// token pour que l'appelant puisse le supprimer a la deconnexion.
// Silencieuse en cas d'echec : ne jamais bloquer l'entree dans l'app parce
// que les notifications ne sont pas disponibles.
export async function enregistrerPourNotifications(): Promise<string | null> {
  // Un emulateur ne peut pas recevoir de push : inutile de demander la
  // permission ni d'appeler Expo.
  if (!Device.isDevice) {
    return null;
  }

  try {
    // Android 13+ : l'invite de permission n'apparait QUE si au moins un
    // canal existe. Creer le canal doit donc preceder la demande.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CANAL_ANDROID, {
        name: 'Trajets et messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#e92934',
      });
    }

    const { status: statutExistant } =
      await Notifications.getPermissionsAsync();
    let statut = statutExistant;
    if (statut !== 'granted') {
      const demande = await Notifications.requestPermissionsAsync();
      statut = demande.status;
    }
    if (statut !== 'granted') {
      return null;
    }

    const projectId = lireProjectId();
    if (!projectId) {
      // Cas normal en developpement tant que `eas init` n'a pas ete lance.
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    await enregistrerAppareilPush(token, Platform.OS === 'ios' ? 'ios' : 'android');
    await SecureStore.setItemAsync(CLE_TOKEN_PUSH, token);
    return token;
  } catch {
    return null;
  }
}

// A APPELER AVANT de supprimer le token d'authentification : la requete de
// desinscription est authentifiee. Sans elle, la personne suivante a utiliser
// ce telephone recevrait les notifications du compte precedent.
export async function desenregistrerAppareil(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(CLE_TOKEN_PUSH);
    if (!token) return;
    await supprimerAppareilPush(token);
    await SecureStore.deleteItemAsync(CLE_TOKEN_PUSH);
  } catch {
    // Sans importance : le backend nettoiera de toute facon le token le jour
    // ou Expo le signalera comme "DeviceNotRegistered".
  }
}

// Ouvre l'ecran concerne quand l'utilisateur touche une notification. Passe
// par navigationRef (deja utilise pour resetToConnexion) : le listener vit
// hors de l'arbre React, il n'a pas acces au hook useNavigation.
function ouvrirDepuisNotification(data: NotificationData): void {
  if (!navigationRef.isReady() || !data.type) {
    return;
  }

  switch (data.type) {
    case 'demande':
      if (data.id) {
        navigationRef.navigate('PointDeRegroupement', { demandeId: data.id });
      }
      break;
    case 'trajet':
      if (data.id) {
        navigationRef.navigate('TrajetDetail', { trajetId: data.id });
      }
      break;
    case 'messagerie':
      if (data.id) {
        navigationRef.navigate('Messagerie', { trajetId: data.id });
      }
      break;
    case 'support':
      // Pas d'id : l'ecran affiche tout l'historique, la reponse etant la
      // plus recente. Seule notification qu'un compte suspendu peut suivre.
      navigationRef.navigate('Support');
      break;
    default:
      // "compte" (suspension) et "notation" ne ciblent pas d'ecran precis :
      // ouvrir l'app suffit.
      break;
  }
}

// Branche les listeners de tap. Retourne une fonction de nettoyage.
export function ecouterNotifications(): () => void {
  // Cas 1 : l'app etait ouverte ou en arriere-plan.
  const sub = Notifications.addNotificationResponseReceivedListener(
    (reponse) => {
      ouvrirDepuisNotification(
        reponse.notification.request.content.data as NotificationData,
      );
    },
  );

  // Cas 2 : l'app etait completement fermee et c'est la notification qui l'a
  // lancee -- le listener ci-dessus ne se declenche jamais dans ce cas.
  void Notifications.getLastNotificationResponseAsync().then((reponse) => {
    if (reponse) {
      ouvrirDepuisNotification(
        reponse.notification.request.content.data as NotificationData,
      );
    }
  });

  return () => sub.remove();
}
