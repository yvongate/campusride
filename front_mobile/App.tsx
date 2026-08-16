import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import {
  useFonts,
  Archivo_400Regular,
  Archivo_600SemiBold,
  Archivo_800ExtraBold,
} from '@expo-google-fonts/archivo';
import * as SplashScreen from 'expo-splash-screen';
import { getAccessToken, getProfile } from './src/api/client';
import { navigationRef } from './src/navigation/navigationRef';
import { OfflineBanner } from './src/components/OfflineBanner';
import type { RootStackParamList } from './src/navigation/types';
import MainTabs from './src/navigation/MainTabs';
import OnboardingScreen from './src/screens/OnboardingScreen';
import LocalisationScreen from './src/screens/LocalisationScreen';
import ConnexionScreen from './src/screens/ConnexionScreen';
import VerificationOtpScreen from './src/screens/VerificationOtpScreen';
import InscriptionConducteurScreen from './src/screens/InscriptionConducteurScreen';
import CompleterProfilScreen from './src/screens/CompleterProfilScreen';
import ChoisirUniversiteScreen from './src/screens/ChoisirUniversiteScreen';
import MesInformationsScreen from './src/screens/MesInformationsScreen';
import ParametresScreen from './src/screens/ParametresScreen';
import AideScreen from './src/screens/AideScreen';
import AvisScreen from './src/screens/AvisScreen';
import TrajetDetailScreen from './src/screens/TrajetDetailScreen';
import RencontreScreen from './src/screens/RencontreScreen';
import PublierTrajetScreen from './src/screens/PublierTrajetScreen';
import MesTrajetsConducteurScreen from './src/screens/MesTrajetsConducteurScreen';
import MessagerieScreen from './src/screens/MessagerieScreen';
import NotationScreen from './src/screens/NotationScreen';
import CreerDemandeScreen from './src/screens/CreerDemandeScreen';
import DemandesDisponiblesScreen from './src/screens/DemandesDisponiblesScreen';
import PointDeRegroupementScreen from './src/screens/PointDeRegroupementScreen';
import SignalerAbsenceScreen from './src/screens/SignalerAbsenceScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

SplashScreen.preventAutoHideAsync();

type InitialRoute = 'Onboarding' | 'MainTabs';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Archivo_400Regular,
    Archivo_600SemiBold,
    Archivo_800ExtraBold,
  });
  const [initialRoute, setInitialRoute] = useState<InitialRoute | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          setInitialRoute('Onboarding');
          return;
        }
        // On valide juste que le token est encore accepte. Le nom ne doit
        // JAMAIS conditionner l'entree dans l'app ici : "CompleterProfil" est
        // un passage unique du premier login (VerificationOtpScreen), et son
        // bouton "Passer" ne persiste rien -- le mettre sur le chemin du
        // demarrage transformait un nom absent en barriere permanente
        // (l'accueil devenait inatteignable a chaque lancement).
        await getProfile();
        setInitialRoute('MainTabs');
      } catch {
        // Token expire/revoque, backend injoignable, ou erreur SecureStore :
        // dans tous les cas on ne doit jamais rester bloque sur le splash.
        await SecureStore.deleteItemAsync('accessToken').catch(() => undefined);
        setInitialRoute('Onboarding');
      }
    })();
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && initialRoute) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, initialRoute]);

  if ((!fontsLoaded && !fontError) || !initialRoute) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <StatusBar style="auto" />
        <OfflineBanner />
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Localisation" component={LocalisationScreen} />
          <Stack.Screen name="Connexion" component={ConnexionScreen} />
          <Stack.Screen
            name="VerificationOtp"
            component={VerificationOtpScreen}
          />
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen
            name="InscriptionConducteur"
            component={InscriptionConducteurScreen}
          />
          <Stack.Screen
            name="CompleterProfil"
            component={CompleterProfilScreen}
          />
          <Stack.Screen
            name="ChoisirUniversite"
            component={ChoisirUniversiteScreen}
          />
          <Stack.Screen
            name="MesInformations"
            component={MesInformationsScreen}
          />
          <Stack.Screen name="Parametres" component={ParametresScreen} />
          <Stack.Screen name="Aide" component={AideScreen} />
          <Stack.Screen name="Avis" component={AvisScreen} />
          <Stack.Screen name="TrajetDetail" component={TrajetDetailScreen} />
          <Stack.Screen name="Rencontre" component={RencontreScreen} />
          <Stack.Screen name="PublierTrajet" component={PublierTrajetScreen} />
          <Stack.Screen
            name="MesTrajetsConducteur"
            component={MesTrajetsConducteurScreen}
          />
          <Stack.Screen name="Messagerie" component={MessagerieScreen} />
          <Stack.Screen name="Notation" component={NotationScreen} />
          <Stack.Screen name="CreerDemande" component={CreerDemandeScreen} />
          <Stack.Screen
            name="DemandesDisponibles"
            component={DemandesDisponiblesScreen}
          />
          <Stack.Screen
            name="PointDeRegroupement"
            component={PointDeRegroupementScreen}
          />
          <Stack.Screen
            name="SignalerAbsence"
            component={SignalerAbsenceScreen}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
