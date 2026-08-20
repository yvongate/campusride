import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import { getTrajetDetail, reserverTrajet, TrajetDetail } from '../api/client';
import { getDisplayName } from '../utils/profile';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorState } from '../components/ErrorState';
import { showError } from '../components/Toast';
import { Tag } from '../components/Tag';
import { ScreenFooter } from '../components/ScreenFooter';
import { ScreenHeader } from '../components/ScreenHeader';
import { H5, MutedText } from '../components/Typography';

type Props = NativeStackScreenProps<RootStackParamList, 'TrajetDetail'>;

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export default function TrajetDetailScreen({ navigation, route }: Props) {
  const { trajetId } = route.params;
  const [trajet, setTrajet] = useState<TrajetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reserving, setReserving] = useState(false);
  const [reserved, setReserved] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getTrajetDetail(trajetId)
      .then(setTrajet)
      .catch((e) =>
        setError(extractErrorMessage(e, 'Impossible de charger ce trajet.')),
      )
      .finally(() => setLoading(false));
  }, [trajetId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleReserver() {
    setReserving(true);
    try {
      await reserverTrajet(trajetId);
      setReserved(true);
      load();
    } catch (e) {
      showError(extractErrorMessage(e, 'La réservation a échoué.'));
    } finally {
      setReserving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Détail du trajet" onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </View>
    );
  }

  if (error || !trajet) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Détail du trajet" onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <ErrorState message={error ?? 'Trajet introuvable.'} onRetry={load} />
        </View>
      </View>
    );
  }

  const conducteurNom = getDisplayName(
    trajet.conducteur.nom,
    trajet.conducteur.prenom,
    'Conducteur',
  );
  const complet = trajet.placesDisponibles <= 0;
  const indisponible = complet || trajet.statut !== 'ouvert';
  const dejaReserve = trajet.dejaReserve || reserved;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Détail du trajet" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.conducteurRow}>
          <Avatar initial={conducteurNom.charAt(0)} size={42} />
          <View style={styles.conducteurInfo}>
            <Text style={styles.conducteurNom}>{conducteurNom}</Text>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('Avis', {
                  userId: trajet.conducteur.id,
                  nom: conducteurNom,
                })
              }
            >
              <MutedText style={styles.meta}>
                {trajet.conducteur.note !== null
                  ? `★ ${trajet.conducteur.note.toFixed(1)} (${trajet.conducteur.nombreNotations} avis)`
                  : 'Aucun avis pour le moment'}
              </MutedText>
            </TouchableOpacity>
          </View>
          {trajet.conducteur.verifie ? <Tag variant="outline" label="Vérifié" /> : null}
        </View>

        <View style={styles.tripBlock}>
          <H5>
            {trajet.pointDeRdv.nom} → {trajet.universite.nom}
          </H5>
          <MutedText style={styles.tripInfo}>
            Départ{' '}
            {new Date(trajet.heure).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </MutedText>
          <MutedText style={styles.tripInfoSmall}>
            {trajet.placesDisponibles} places restantes sur {trajet.places}
          </MutedText>
        </View>

        <Card style={styles.priceCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.priceTotalLabel}>Cotisation par personne</Text>
            <Text style={styles.priceTotal}>{trajet.cotisation} FCFA</Text>
          </View>
          <View style={styles.hr} />
          <Text style={styles.priceLine}>
            Ce montant est fixe : il ne changera pas selon le nombre de
            passagers qui réservent.
          </Text>
        </Card>

        {reserved ? (
          <Text style={styles.success}>Réservation confirmée !</Text>
        ) : null}
      </ScrollView>

      <ScreenFooter>
        <Button
          title={
            dejaReserve
              ? 'Trajet déjà réservé'
              : complet
                ? 'Trajet complet'
                : trajet.statut !== 'ouvert'
                  ? 'Trajet indisponible'
                  : `Réserver ma place — ${trajet.cotisation} FCFA`
          }
          block
          loading={reserving}
          disabled={indisponible || dejaReserve}
          onPress={() => void handleReserver()}
        />
      </ScreenFooter>
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 16,
  },
  conducteurRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: colors.divider,
  },
  conducteurInfo: {
    flex: 1,
  },
  conducteurNom: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14.5,
    color: colors.text,
  },
  meta: {
    fontSize: 11,
  },
  tripBlock: {
    gap: 4,
  },
  tripInfo: {
    fontSize: 13,
  },
  tripInfoSmall: {
    fontSize: 12.5,
  },
  priceCard: {
    backgroundColor: colors.accent100,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceLine: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.text,
  },
  hr: {
    height: 2,
    backgroundColor: colors.divider,
    marginVertical: 4,
  },
  priceTotalLabel: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  priceTotal: {
    fontFamily: fonts.heading,
    fontSize: 24,
    color: colors.accent700,
  },
  success: {
    fontFamily: fonts.headingSemiBold,
    color: colors.text,
    textAlign: 'center',
    marginTop: 8,
  },
});
