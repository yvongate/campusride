import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { desenregistrerAppareil } from '../utils/push';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabsParamList, RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import { getProfile, Profile } from '../api/client';
import { getDisplayName } from '../utils/profile';
import { Button } from '../components/Button';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons';
import { Tag } from '../components/Tag';
import { H4, MutedText } from '../components/Typography';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabsParamList, 'Profil'>,
  NativeStackScreenProps<RootStackParamList>
>;

function MenuRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress}>
      <Text style={styles.menuLabel}>{label}</Text>
      <ChevronRightIcon color={colors.text} />
    </TouchableOpacity>
  );
}

export default function ProfilScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Reload a chaque fois que l'onglet reprend le focus -- sinon un
    // changement fait ailleurs (ex. admin qui valide un conducteur) ne se
    // reflete qu'apres deconnexion/reconnexion, l'ecran n'etant charge
    // qu'au montage sinon.
    const unsubscribe = navigation.addListener('focus', () => {
      getProfile()
        .then((data) => {
          if (!cancelled) setProfile(data);
        })
        .catch(() => {
          if (!cancelled) setError('Impossible de charger ton profil.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [navigation]);

  async function handleLogout() {
    // AVANT la suppression du token d'auth : la desinscription est une
    // requete authentifiee. Sinon l'utilisateur suivant de ce telephone
    // recevrait les notifications de ce compte.
    await desenregistrerAppareil();
    await SecureStore.deleteItemAsync('accessToken');
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: 'Onboarding' }],
    });
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? 'Profil introuvable.'}</Text>
      </View>
    );
  }

  const displayName = getDisplayName(
    profile.nom,
    profile.prenom,
    profile.telephone,
  );
  const noteLabel =
    profile.note !== null
      ? `★ ${profile.note.toFixed(1)} (${profile.nombreNotations} avis)`
      : 'Pas encore noté';
  const demandeEnAttente = profile.conducteurStatut === 'en attente';
  const demandeRefusee = profile.conducteurStatut === 'refuse';
  const estConducteur = profile.conducteurStatut === 'valide';
  const roleLabel = estConducteur ? 'Conducteur' : 'Étudiant';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity
          style={styles.back}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <ChevronLeftIcon color={colors.text} />
        </TouchableOpacity>
        <H4 style={styles.name}>{displayName}</H4>
        <MutedText style={styles.meta}>
          {noteLabel} · {roleLabel}
        </MutedText>
        {estConducteur ? (
          <Tag variant="outline" label="Conducteur vérifié" style={styles.verifTag} />
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {estConducteur ? (
          <>
            <View style={styles.conducteurLinks}>
              <Button
                title="Publier un trajet"
                block
                onPress={() => navigation.navigate('PublierTrajet')}
              />
              <Button
                title="Mes trajets (conducteur)"
                variant="secondary"
                block
                onPress={() => navigation.navigate('MesTrajetsConducteur')}
              />
              <Button
                title="Demandes disponibles"
                variant="secondary"
                block
                onPress={() => navigation.navigate('DemandesDisponibles')}
              />
            </View>
            <View style={styles.menu}>
              <MenuRow
                label="Mes informations"
                onPress={() => navigation.navigate('MesInformations')}
              />
              <MenuRow
                label="Historique des trajets"
                onPress={() =>
                  navigation.navigate('MesTrajetsConducteur', {
                    tab: 'termines',
                  })
                }
              />
              <MenuRow
                label="Paramètres"
                onPress={() => navigation.navigate('Parametres')}
              />
              <MenuRow label="Aide" onPress={() => navigation.navigate('Aide')} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.becomeDriverCard}>
              <Text style={styles.becomeDriverTitle}>Devenir conducteur</Text>
              <Text style={styles.becomeDriverBody}>
                Selfie, permis de conduire et matricule véhicule — validation
                sous 48h.
              </Text>
              {demandeEnAttente ? (
                <Tag variant="neutral" label="Demande en cours d'examen" />
              ) : demandeRefusee ? (
                <Tag variant="outline" label="Demande refusée" />
              ) : (
                <Button
                  title="Faire une demande"
                  onPress={() => navigation.navigate('InscriptionConducteur')}
                />
              )}
            </View>
            <View style={styles.menu}>
              <MenuRow
                label="Mes informations"
                onPress={() => navigation.navigate('MesInformations')}
              />
              <MenuRow
                label="Historique des trajets"
                onPress={() =>
                  navigation.navigate('MesTrajetsPassager', {
                    tab: 'historique',
                  })
                }
              />
              <MenuRow
                label="Paramètres"
                onPress={() => navigation.navigate('Parametres')}
              />
              <MenuRow label="Aide" onPress={() => navigation.navigate('Aide')} />
            </View>
          </>
        )}

        <Button
          title="Déconnexion"
          variant="ghost"
          onPress={() => void handleLogout()}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.divider,
  },
  back: {
    padding: 2,
    marginBottom: 12,
  },
  name: {
    marginTop: 10,
  },
  meta: {
    fontSize: 13,
    marginTop: 2,
  },
  verifTag: {
    marginTop: 8,
  },
  body: {
    padding: 20,
    gap: 14,
  },
  conducteurLinks: {
    gap: 10,
  },
  becomeDriverCard: {
    backgroundColor: colors.text,
    padding: 16,
    gap: 6,
  },
  becomeDriverTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14.5,
    color: colors.background,
  },
  becomeDriverBody: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(243,242,242,0.78)',
    marginBottom: 6,
  },
  menu: {
    marginTop: 4,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  menuLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  error: {
    color: colors.accent,
    fontSize: 14,
    textAlign: 'center',
  },
});
