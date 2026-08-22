import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabsParamList, RootStackParamList } from '../navigation/types';
import { colors } from '../theme';
import { getProfile } from '../api/client';
import MesTrajetsPassagerScreen from './MesTrajetsPassagerScreen';
import MesTrajetsConducteurScreen from './MesTrajetsConducteurScreen';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabsParamList, 'MesTrajetsPassager'>,
  NativeStackScreenProps<RootStackParamList>
>;

// Aiguillage de l'onglet "Trajets". Il affichait toujours la vue PASSAGER :
// un conducteur non etudiant, qui n'aura jamais la moindre reservation, y
// trouvait un ecran vide et n'avait aucun moyen d'atteindre le trajet qu'il
// venait d'accepter -- ni de l'annuler ou de le terminer, ces actions vivant
// uniquement dans la vue conducteur, accessible seulement via le Profil.
export default function MesTrajetsScreen(props: Props) {
  const [role, setRole] = useState<string | null>(null);
  const [charge, setCharge] = useState(false);

  const charger = useCallback(() => {
    getProfile()
      .then((profile) => setRole(profile.role))
      .catch(() => setRole(null))
      .finally(() => setCharge(true));
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  // Le role peut changer en cours de session (un dossier valide par un admin
  // fait passer "etudiant" a "les deux") : on le relit a chaque retour sur
  // l'onglet plutot qu'une seule fois au montage.
  useEffect(() => {
    return props.navigation.addListener('focus', charger);
  }, [props.navigation, charger]);

  if (!charge) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // "chauffeur" = conducteur non etudiant : la vue passager ne le concerne
  // jamais. "les deux" garde la vue passager par defaut, ses trajets de
  // conducteur restant accessibles depuis le Profil.
  if (role === 'chauffeur') {
    return (
      <MesTrajetsConducteurScreen
        {...(props as unknown as NativeStackScreenProps<
          RootStackParamList,
          'MesTrajetsConducteur'
        >)}
        masquerRetour
      />
    );
  }

  return <MesTrajetsPassagerScreen {...props} />;
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
