import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Archivo_400Regular,
  Archivo_600SemiBold,
  Archivo_800ExtraBold,
} from '@expo-google-fonts/archivo';
import * as SplashScreen from 'expo-splash-screen';
import type { RootStackParamList } from './src/navigation/types';
import MainTabs from './src/navigation/MainTabs';
import OnboardingScreen from './src/screens/OnboardingScreen';
import ConnexionScreen from './src/screens/ConnexionScreen';
import VerificationOtpScreen from './src/screens/VerificationOtpScreen';
import InscriptionConducteurScreen from './src/screens/InscriptionConducteurScreen';
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

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Archivo_400Regular,
    Archivo_600SemiBold,
    Archivo_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator
          initialRouteName="Onboarding"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
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
