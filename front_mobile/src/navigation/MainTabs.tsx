import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { MainTabsParamList } from './types';
import { LiquidGlassTabBar } from './LiquidGlassTabBar';
import AccueilScreen from '../screens/AccueilScreen';
import MesTrajetsPassagerScreen from '../screens/MesTrajetsPassagerScreen';
import MessagesHubScreen from '../screens/MessagesHubScreen';
import ProfilScreen from '../screens/ProfilScreen';

const Tab = createBottomTabNavigator<MainTabsParamList>();

// Barre du bas remplacée par une pilule flottante "liquid glass" (voir
// LiquidGlassTabBar.tsx) -- Profil n'y figure plus, accessible via le bouton
// burger des 3 écrans restants (voir BurgerButton.tsx).
export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <LiquidGlassTabBar {...props} />}
    >
      <Tab.Screen name="Accueil" component={AccueilScreen} />
      <Tab.Screen name="MesTrajetsPassager" component={MesTrajetsPassagerScreen} />
      <Tab.Screen name="MessagesHub" component={MessagesHubScreen} />
      <Tab.Screen name="Profil" component={ProfilScreen} />
    </Tab.Navigator>
  );
}
