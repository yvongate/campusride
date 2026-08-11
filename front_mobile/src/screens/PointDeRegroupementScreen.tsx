import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import {
  annulerDemande,
  DemandeDetail,
  getDemandeDetail,
  getProfile,
} from '../api/client';
import { formatPlacesRestantes } from '../utils/places';
import { getDisplayName } from '../utils/profile';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ScreenFooter } from '../components/ScreenFooter';
import { ScreenHeader } from '../components/ScreenHeader';
import { H5, H6, MutedText } from '../components/Typography';
import { WaitingIllustration } from '../components/WaitingIllustration';

type Props = NativeStackScreenProps<RootStackParamList, 'PointDeRegroupement'>;

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export default function PointDeRegroupementScreen({ navigation, route }: Props) {
  const { demandeId } = route.params;
  const [demande, setDemande] = useState<DemandeDetail | null>(null);
  const [monId, setMonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [annulerPending, setAnnulerPending] = useState(false);
  const [annulerError, setAnnulerError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getDemandeDetail(demandeId)
      .then(setDemande)
      .catch((e) =>
        setError(extractErrorMessage(e, 'Impossible de charger cette demande.')),
      )
      .finally(() => setLoading(false));
  }, [demandeId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  useEffect(() => {
    getProfile()
      .then((profile) => setMonId(profile.id))
      .catch(() => undefined);
  }, []);

  async function handleAnnuler() {
    setAnnulerPending(true);
    setAnnulerError(null);
    try {
      await annulerDemande(demandeId);
      load();
    } catch (e) {
      setAnnulerError(extractErrorMessage(e, "L'annulation a échoué."));
    } finally {
      setAnnulerPending(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (error || !demande) {
    return (
      <View style={styles.centered}>
        <MutedText>{error ?? 'Demande introuvable.'}</MutedText>
      </View>
    );
  }

  const peutAnnuler =
    demande.createur.id === monId &&
    (demande.statut === 'ouverte' || demande.statut === 'quota_atteint');
  const estExpiree = demande.statut === 'expiree';
  const estAnnulee = demande.statut === 'annulee';
  const estFermee = estExpiree || estAnnulee;
  const quotaAtteint = demande.placesConfirmees >= demande.placesRecherchees;
  const progress = Math.min(
    1,
    demande.placesRecherchees > 0
      ? demande.placesConfirmees / demande.placesRecherchees
      : 0,
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={`${demande.commune.nom} → ${demande.universite.nom}`}
        subtitle={new Date(demande.heure).toLocaleString()}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {estFermee ? (
          <Card style={styles.fermeeCard}>
            <H6 style={styles.fermeeTitle}>
              {estExpiree ? 'Demande expirée' : 'Demande annulée'}
            </H6>
            <MutedText style={styles.fermeeBody}>
              {estExpiree
                ? "Personne n'a rejoint à temps avant le départ prévu -- cette demande est close."
                : 'Le créateur a annulé cette demande -- elle ne recevra plus de participants.'}
            </MutedText>
          </Card>
        ) : null}

        <View>
          <View style={styles.progressLabelRow}>
            <MutedText style={styles.progressLabel}>
              {estFermee
                ? 'FERMÉE'
                : quotaAtteint
                  ? 'QUOTA ATTEINT'
                  : 'EN ATTENTE DE PARTICIPANTS'}
            </MutedText>
            <MutedText style={styles.progressLabel}>
              {formatPlacesRestantes(demande.placesRecherchees, demande.placesConfirmees)}
            </MutedText>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        <Card style={styles.darkCard}>
          <H6 style={styles.darkKicker}>Places (participants anonymes)</H6>
          <View style={styles.avatarRow}>
            {Array.from({ length: demande.placesRecherchees }).map((_, index) => (
              <Avatar
                key={index}
                initial=""
                size={34}
                background={
                  index < demande.placesConfirmees
                    ? colors.accent
                    : colors.neutral900
                }
                style={
                  index >= demande.placesConfirmees
                    ? styles.avatarPlaceholder
                    : undefined
                }
              />
            ))}
          </View>
          <MutedText style={styles.darkCaption}>
            Chaque place s'allume dès qu'un participant rejoint la demande. Les
            identités restent anonymes jusqu'à l'acceptation.
          </MutedText>
        </Card>

        {demande.poi ? (
          <Card style={styles.poiCard}>
            <View style={styles.poiBody}>
              <H6 style={styles.poiKicker}>Point de regroupement suggéré</H6>
              <H5>{demande.poi.nom}</H5>
              <MutedText>
                On a trouvé l'endroit le plus pratique pour que tout le monde
                se retrouve facilement.
              </MutedText>
            </View>
          </Card>
        ) : estFermee ? (
          <Card style={styles.waitingCard}>
            <H6 style={styles.waitingTitle}>Aucun point de regroupement trouvé</H6>
            <MutedText style={styles.waitingBody}>
              Le quota n'a pas été atteint avant la fermeture de cette
              demande.
            </MutedText>
          </Card>
        ) : (
          <Card style={styles.waitingCard}>
            <WaitingIllustration />
            <H6 style={styles.waitingTitle}>On cherche le meilleur point de regroupement</H6>
            <MutedText style={styles.waitingBody}>
              Dès que tout le monde aura rejoint la demande, on proposera
              automatiquement l'endroit le plus pratique pour se retrouver.
            </MutedText>
          </Card>
        )}

        {demande.conducteur ? (
          <View style={styles.conducteurRow}>
            <Avatar
              initial={(demande.conducteur.nom ?? demande.conducteur.prenom ?? 'C').charAt(0)}
            />
            <View style={styles.conducteurInfo}>
              <MutedText style={styles.conducteurTitle}>
                {getDisplayName(
                  demande.conducteur.nom,
                  demande.conducteur.prenom,
                  'Conducteur',
                )}{' '}
                a accepté
              </MutedText>
              <MutedText style={styles.conducteurMeta}>
                {demande.conducteur.note !== null
                  ? `★ ${demande.conducteur.note.toFixed(1)}`
                  : null}
                {demande.conducteur.matriculeVehicule
                  ? ` · ${demande.conducteur.matriculeVehicule}`
                  : ''}
              </MutedText>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {demande.conducteur && demande.trajetId ? (
        <ScreenFooter>
          <Button
            title="Ouvrir la messagerie"
            variant="secondary"
            block
            onPress={() =>
              navigation.navigate('Messagerie', { trajetId: demande.trajetId as string })
            }
          />
        </ScreenFooter>
      ) : peutAnnuler ? (
        <ScreenFooter>
          {annulerError ? <Text style={styles.error}>{annulerError}</Text> : null}
          <Button
            title="Annuler cette demande"
            variant="ghost"
            block
            loading={annulerPending}
            onPress={() => void handleAnnuler()}
          />
        </ScreenFooter>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fermeeCard: {
    backgroundColor: colors.neutral900,
    gap: 4,
  },
  fermeeTitle: {
    color: colors.background,
  },
  fermeeBody: {
    color: colors.background,
    opacity: 0.7,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 12,
    color: colors.accent700,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.neutral200,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  darkCard: {
    backgroundColor: colors.neutral900,
    alignItems: 'center',
  },
  darkKicker: {
    alignSelf: 'flex-start',
    color: colors.background,
    opacity: 0.7,
  },
  avatarRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 10,
  },
  avatarPlaceholder: {
    borderWidth: 1.5,
    borderColor: colors.neutral500,
  },
  darkCaption: {
    fontSize: 11,
    textAlign: 'center',
    color: colors.background,
    opacity: 0.55,
  },
  poiCard: {
    padding: 0,
  },
  poiBody: {
    padding: 14,
    gap: 4,
  },
  poiKicker: {
    color: colors.accent700,
  },
  waitingCard: {
    alignItems: 'center',
    gap: 4,
  },
  waitingTitle: {
    textAlign: 'center',
    marginTop: 4,
  },
  waitingBody: {
    textAlign: 'center',
  },
  conducteurRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 14,
  },
  conducteurInfo: {
    flex: 1,
  },
  conducteurTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 13.5,
    color: colors.text,
  },
  conducteurMeta: {
    fontSize: 11,
  },
  error: {
    color: colors.accent,
    fontSize: 12.5,
    marginBottom: 8,
  },
});
