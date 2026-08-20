import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorState } from '../components/ErrorState';
import { Field, Input } from '../components/Field';
import { H5, MutedText } from '../components/Typography';
import { showError, showSuccess } from '../components/Toast';
import { AxiosError } from 'axios';
import { listerMesMessagesSupport, envoyerMessageSupport } from '../api/client';
import type { MessageSupport } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'Support'>;

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

const LONGUEUR_MIN = 10;
const LONGUEUR_MAX = 2000;

function formaterDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function SupportScreen({ navigation }: Props) {
  const [messages, setMessages] = useState<MessageSupport[]>([]);
  const [chargement, setChargement] = useState(true);
  const [rafraichissement, setRafraichissement] = useState(false);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [contenu, setContenu] = useState('');
  // Erreur de saisie : en ligne sous le champ, pas en toast -- elle concerne
  // le champ lui-meme et doit rester visible pendant la correction.
  const [erreurSaisie, setErreurSaisie] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    try {
      setErreurChargement(null);
      setMessages(await listerMesMessagesSupport());
    } catch (e) {
      setErreurChargement(
        extractErrorMessage(e, 'Impossible de charger tes messages.'),
      );
    } finally {
      setChargement(false);
      setRafraichissement(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const envoyer = async () => {
    const texte = contenu.trim();
    if (texte.length < LONGUEUR_MIN) {
      setErreurSaisie('Explique ta situation en quelques mots.');
      return;
    }

    setErreurSaisie(null);
    setEnvoi(true);
    try {
      await envoyerMessageSupport(texte);
      setContenu('');
      showSuccess('Message envoyé. On te répond dès que possible.');
      await charger();
    } catch (e) {
      showError(extractErrorMessage(e, "L'envoi du message a échoué."));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader
        title="Nous contacter"
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={rafraichissement}
            onRefresh={() => {
              setRafraichissement(true);
              void charger();
            }}
          />
        }
      >
        <MutedText style={styles.intro}>
          Un problème sur un trajet, une sanction que tu juges injustifiée, un
          bug ? Écris-nous ici. La réponse s'affichera sur cette page.
        </MutedText>

        <Field label="Ton message">
          <Input
            value={contenu}
            onChangeText={(t) => {
              setContenu(t);
              if (erreurSaisie) {
                setErreurSaisie(null);
              }
            }}
            placeholder="Décris ta situation…"
            multiline
            maxLength={LONGUEUR_MAX}
            style={styles.zoneTexte}
          />
        </Field>
        {erreurSaisie ? (
          <Text style={styles.erreurSaisie}>{erreurSaisie}</Text>
        ) : null}

        <Button
          title="Envoyer"
          block
          loading={envoi}
          onPress={() => void envoyer()}
        />

        <H5 style={styles.titreHistorique}>Mes messages</H5>

        {chargement ? (
          <ActivityIndicator color={colors.accent} style={styles.chargement} />
        ) : erreurChargement ? (
          <ErrorState message={erreurChargement} onRetry={() => void charger()} />
        ) : messages.length === 0 ? (
          <MutedText style={styles.vide}>
            Tu n'as encore envoyé aucun message.
          </MutedText>
        ) : (
          messages.map((message) => (
            <Card key={message.id} style={styles.carte}>
              <View style={styles.entete}>
                <MutedText style={styles.date}>
                  {formaterDate(message.createdAt)}
                </MutedText>
                <Text
                  style={[
                    styles.statut,
                    message.statut === 'traite'
                      ? styles.statutTraite
                      : styles.statutOuvert,
                  ]}
                >
                  {message.statut === 'traite' ? 'Répondu' : 'En attente'}
                </Text>
              </View>
              <Text style={styles.contenu}>{message.contenu}</Text>
              {message.reponse ? (
                <View style={styles.reponse}>
                  <Text style={styles.reponseTitre}>Réponse de CampusRide</Text>
                  <Text style={styles.contenu}>{message.reponse}</Text>
                </View>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 14,
  },
  intro: {
    fontSize: 12.5,
    lineHeight: 18.5,
  },
  zoneTexte: {
    minHeight: 110,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  erreurSaisie: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.accent,
    marginTop: -8,
  },
  titreHistorique: {
    marginTop: 10,
  },
  chargement: {
    marginTop: 12,
  },
  vide: {
    fontSize: 12.5,
  },
  carte: {
    gap: 8,
  },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  date: {
    fontSize: 11.5,
  },
  statut: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statutOuvert: {
    color: colors.neutral600,
  },
  statutTraite: {
    color: colors.accent,
  },
  contenu: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
  },
  reponse: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: colors.neutral300,
    paddingTop: 8,
  },
  reponseTitre: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 12,
    color: colors.accent,
  },
});
