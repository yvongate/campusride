import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabsParamList, RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import { BurgerButton } from '../components/BurgerButton';
import { Card } from '../components/Card';
import { H4, MutedText } from '../components/Typography';
import {
  listerMesReservations,
  listerMesTrajetsConducteur,
} from '../api/client';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabsParamList, 'MessagesHub'>,
  NativeStackScreenProps<RootStackParamList>
>;

interface ChatEntry {
  trajetId: string;
  titre: string;
  heure: string;
}

export default function MessagesHubScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [chats, setChats] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reservations, mesTrajets] = await Promise.all([
        listerMesReservations().catch(() => []),
        listerMesTrajetsConducteur().catch(() => []),
      ]);

      const entries: ChatEntry[] = [];
      for (const trajet of reservations) {
        if (trajet.statut === 'ouvert' || trajet.statut === 'commence') {
          const nom =
            trajet.conducteur.nom ?? trajet.conducteur.prenom ?? 'Conducteur';
          entries.push({
            trajetId: trajet.id,
            titre: `${nom} → ${trajet.universite.nom}`,
            heure: trajet.heure,
          });
        }
      }
      for (const trajet of mesTrajets) {
        if (trajet.statut === 'ouvert' || trajet.statut === 'commence') {
          entries.push({
            trajetId: trajet.id,
            titre: `${trajet.pointDeRdv.nom} → ${trajet.universite.nom}`,
            heure: trajet.heure,
          });
        }
      }
      entries.sort((a, b) => new Date(a.heure).getTime() - new Date(b.heure).getTime());
      setChats(entries);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => void load());
    return unsubscribe;
  }, [navigation, load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTitleRow}>
          <H4>Messages</H4>
          <BurgerButton onPress={() => navigation.navigate('Profil')} />
        </View>
      </View>
      <FlatList
        data={chats}
        keyExtractor={(item) => item.trajetId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <MutedText style={styles.empty}>
            Aucune conversation active pour le moment.
          </MutedText>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('Messagerie', { trajetId: item.trajetId })
            }
          >
            <Card>
              <H4 style={styles.cardTitle}>{item.titre}</H4>
              <MutedText>{new Date(item.heure).toLocaleString()}</MutedText>
            </Card>
          </TouchableOpacity>
        )}
      />
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
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.divider,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  list: {
    padding: 20,
    gap: 12,
  },
  cardTitle: {
    fontFamily: fonts.heading,
    fontSize: 14.5,
  },
  empty: {
    textAlign: 'center',
    marginTop: 24,
  },
});
