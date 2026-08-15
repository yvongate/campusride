import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AxiosError } from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import { envoyerMessage, getProfile, getTrajetDetail, listerMessages, Message } from '../api/client';
import { getDisplayName } from '../utils/profile';
import { ScreenHeader } from '../components/ScreenHeader';
import { SendIcon } from '../components/icons';
import { MutedText } from '../components/Typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Messagerie'>;

const POLL_INTERVAL_MS = 4000;

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export default function MessagerieScreen({ navigation, route }: Props) {
  const { trajetId } = route.params;
  const insets = useSafeAreaInsets();
  const [selfId, setSelfId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('Messagerie');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const data = await listerMessages(trajetId);
      if (mountedRef.current) setMessages(data);
    } catch (e) {
      if (mountedRef.current) {
        setError(extractErrorMessage(e, 'Impossible de charger le chat.'));
      }
    }
  }, [trajetId]);

  useEffect(() => {
    mountedRef.current = true;
    getProfile()
      .then((profile) => {
        if (mountedRef.current) setSelfId(profile.id);
      })
      .catch(() => undefined);
    getTrajetDetail(trajetId)
      .then((trajet) => {
        if (mountedRef.current) {
          setTitle(`${trajet.pointDeRdv.nom} → ${trajet.universite.nom}`);
        }
      })
      .catch(() => undefined);

    load().finally(() => {
      if (mountedRef.current) setLoading(false);
    });

    const interval = setInterval(() => {
      void load();
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [load, trajetId]);

  const participants = Array.from(
    new Map(
      messages.map((m) => [
        m.expediteurId,
        getDisplayName(m.expediteur.nom, m.expediteur.prenom, 'Utilisateur'),
      ]),
    ).values(),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    if (mountedRef.current) setRefreshing(false);
  }

  async function handleEnvoyer() {
    const contenu = draft.trim();
    if (!contenu) return;
    setSending(true);
    setError(null);
    try {
      await envoyerMessage(trajetId, contenu);
      setDraft('');
      await load();
    } catch (e) {
      setError(extractErrorMessage(e, "L'envoi a échoué."));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader
        title={title}
        subtitle={participants.length > 0 ? participants.join(', ') : undefined}
        onBack={() => navigation.goBack()}
        surface
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <MutedText style={styles.empty}>Aucun message pour le moment.</MutedText>
        }
        renderItem={({ item }) => {
          const isSelf = item.expediteurId === selfId;
          const nom = getDisplayName(
            item.expediteur.nom,
            item.expediteur.prenom,
            'Utilisateur',
          );
          return (
            <View
              style={[
                styles.bubble,
                isSelf ? styles.bubbleSelf : styles.bubbleOther,
              ]}
            >
              {!isSelf ? <Text style={styles.bubbleAuteur}>{nom}</Text> : null}
              <Text
                style={[
                  styles.bubbleContenu,
                  isSelf && styles.bubbleContenuSelf,
                ]}
              >
                {item.contenu}
              </Text>
            </View>
          );
        }}
      />

      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 10 }]}>
        <TextInput
          style={styles.input}
          placeholder="Écrire un message…"
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, (sending || !draft.trim()) && styles.sendButtonDisabled]}
          onPress={() => void handleEnvoyer()}
          disabled={sending || !draft.trim()}
        >
          <SendIcon />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  list: {
    padding: 20,
  },
  bubble: {
    maxWidth: '75%',
    padding: 9,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  bubbleSelf: {
    alignSelf: 'flex-end',
    backgroundColor: colors.text,
  },
  bubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
  },
  bubbleAuteur: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 11,
    color: colors.accent700,
    marginBottom: 2,
  },
  bubbleContenu: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: colors.text,
  },
  bubbleContenuSelf: {
    color: colors.background,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 2,
    borderTopColor: colors.divider,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    fontFamily: fonts.body,
    fontSize: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
  },
  sendButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  empty: {
    textAlign: 'center',
    marginTop: 24,
  },
  error: {
    color: colors.accent,
    fontSize: 13,
    marginHorizontal: 20,
    marginTop: 8,
  },
});
