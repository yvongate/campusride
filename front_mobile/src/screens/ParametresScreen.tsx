import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import { Button } from '../components/Button';
import { ScreenHeader } from '../components/ScreenHeader';
import { Tag } from '../components/Tag';
import { H5, MutedText } from '../components/Typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Parametres'>;

export default function ParametresScreen({ navigation }: Props) {
  const [locStatut, setLocStatut] = useState<Location.PermissionStatus | null>(
    null,
  );

  const rafraichirLocalisation = useCallback(async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setLocStatut(status);
  }, []);

  useEffect(() => {
    void rafraichirLocalisation();
    // Le reglage se change hors de l'app : on revalide au retour sur l'ecran.
    const unsubscribe = navigation.addListener('focus', () => {
      void rafraichirLocalisation();
    });
    return unsubscribe;
  }, [navigation, rafraichirLocalisation]);

  async function handleLogout() {
    await SecureStore.deleteItemAsync('accessToken');
    navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
  }

  const autorisee = locStatut === 'granted';
  const version = Constants.expoConfig?.version ?? '—';

  return (
    <View style={styles.container}>
      <ScreenHeader title="Paramètres" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <H5>Localisation</H5>
          <MutedText style={styles.body}>
            Elle sert à te proposer les trajets et demandes proches de toi, et à
            calculer le point de regroupement d'un groupe.
          </MutedText>
          <View style={styles.tagRow}>
            <Tag
              variant={autorisee ? 'accent' : 'outline'}
              label={autorisee ? 'Autorisée' : 'Non autorisée'}
            />
          </View>
          <Button
            title="Ouvrir les réglages du téléphone"
            variant="secondary"
            block
            onPress={() => void Linking.openSettings()}
          />
        </View>

        <View style={styles.section}>
          <H5>À propos</H5>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>{version}</Text>
          </View>
          <MutedText style={styles.body}>
            CampusRide — covoiturage entre étudiants, Abidjan.
          </MutedText>
        </View>

        <View style={styles.section}>
          <H5>Compte</H5>
          <Button
            title="Modifier mes informations"
            variant="secondary"
            block
            onPress={() => navigation.navigate('MesInformations')}
          />
          <Button
            title="Déconnexion"
            variant="ghost"
            block
            onPress={() => void handleLogout()}
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
    paddingBottom: 24,
    gap: 26,
  },
  section: {
    gap: 8,
  },
  body: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  tagRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  infoLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  infoValue: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.text,
  },
});
