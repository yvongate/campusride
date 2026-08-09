import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import {
  getAccessToken,
  getRencontre,
  getRencontrePhotoUrl,
  RencontreConducteur,
} from '../api/client';
import { getDisplayName } from '../utils/profile';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ImagePlaceholder } from '../components/ImagePlaceholder';
import { ScreenFooter } from '../components/ScreenFooter';
import { ScreenHeader } from '../components/ScreenHeader';
import { Tag } from '../components/Tag';
import { MutedText } from '../components/Typography';

type Props = NativeStackScreenProps<RootStackParamList, 'Rencontre'>;

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export default function RencontreScreen({ navigation, route }: Props) {
  const { trajetId } = route.params;
  const [conducteur, setConducteur] = useState<RencontreConducteur | null>(
    null,
  );
  const [photoToken, setPhotoToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getRencontre(trajetId), getAccessToken()])
      .then(([data, token]) => {
        if (cancelled) return;
        setConducteur(data.conducteur);
        setPhotoToken(token);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            extractErrorMessage(e, "Impossible d'afficher la rencontre."),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trajetId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (error || !conducteur) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Rencontre" onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <MutedText>{error ?? 'Rencontre indisponible.'}</MutedText>
        </View>
      </View>
    );
  }

  const nom = getDisplayName(conducteur.nom, conducteur.prenom, 'Conducteur');

  return (
    <View style={styles.container}>
      <ScreenHeader title="Ton conducteur arrive" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        {conducteur.photoVehicule && photoToken ? (
          <Image
            source={{
              uri: getRencontrePhotoUrl(trajetId),
              headers: { Authorization: `Bearer ${photoToken}` },
            }}
            style={styles.photo}
            resizeMode="cover"
          />
        ) : (
          <ImagePlaceholder label="photo du véhicule" style={styles.photo} />
        )}

        {conducteur.matriculeVehicule ? (
          <View style={styles.plateRow}>
            <MutedText style={styles.plateLabel}>Plaque d'immatriculation</MutedText>
            <Text style={styles.plateValue}>{conducteur.matriculeVehicule}</Text>
          </View>
        ) : null}

        <View style={styles.conducteurRow}>
          <Avatar initial={nom.charAt(0)} />
          <View style={styles.conducteurInfo}>
            <Text style={styles.nom}>{nom}</Text>
            {conducteur.note !== null ? (
              <MutedText style={styles.meta}>★ {conducteur.note.toFixed(1)}</MutedText>
            ) : null}
          </View>
          {conducteur.verifie ? <Tag variant="outline" label="Vérifié" /> : null}
        </View>

        {conducteur.motBienvenue ? (
          <Card>
            <Text style={styles.quote}>« {conducteur.motBienvenue} »</Text>
          </Card>
        ) : null}
      </ScrollView>

      <ScreenFooter>
        <Button
          title="Ouvrir la messagerie"
          block
          onPress={() => navigation.navigate('Messagerie', { trajetId })}
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
  photo: {
    width: '100%',
    height: 180,
  },
  plateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.divider,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  plateLabel: {
    fontSize: 12,
  },
  plateValue: {
    fontFamily: fonts.heading,
    fontSize: 15,
    color: colors.text,
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
  nom: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  meta: {
    fontSize: 11,
  },
  quote: {
    fontFamily: fonts.body,
    fontStyle: 'italic',
    fontSize: 13,
    color: colors.text,
  },
});
