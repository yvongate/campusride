import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AxiosError } from 'axios';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme';
import { declarerChauffeur, getProfile, listUniversites, updateNom, updateUniversite, Profile, Universite } from '../api/client';
import { Button } from '../components/Button';
import { ErrorState } from '../components/ErrorState';
import { Field, Input } from '../components/Field';
import { PickerField } from '../components/PickerField';
import { ScreenHeader } from '../components/ScreenHeader';
import { showError } from '../components/Toast';
import { Tag } from '../components/Tag';
import { MutedText } from '../components/Typography';

type Props = NativeStackScreenProps<RootStackParamList, 'MesInformations'>;

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

function statutTag(conducteurStatut: string | null) {
  if (conducteurStatut === 'valide') {
    return { variant: 'accent' as const, label: 'Conducteur vérifié' };
  }
  if (conducteurStatut === 'en attente') {
    return { variant: 'neutral' as const, label: "Demande conducteur en cours d'examen" };
  }
  if (conducteurStatut === 'refuse') {
    return { variant: 'outline' as const, label: 'Demande conducteur refusée' };
  }
  return { variant: 'neutral' as const, label: 'Étudiant' };
}

export default function MesInformationsScreen({ navigation }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [universites, setUniversites] = useState<Universite[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [universiteSaved, setUniversiteSaved] = useState(false);
  const [chauffeurPending, setChauffeurPending] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([getProfile(), listUniversites()])
      .then(([data, universitesData]) => {
        setProfile(data);
        setNom(data.nom ?? '');
        setUniversites(universitesData);
      })
      .catch((e) =>
        setLoadError(extractErrorMessage(e, 'Impossible de charger ton profil.')),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleChoisirUniversite(id: string) {
    setUniversiteSaved(false);
    try {
      await updateUniversite(id);
      const nomUniversite = universites.find((u) => u.id === id)?.nom ?? null;
      setProfile((current) =>
        current
          ? {
              ...current,
              universiteId: id,
              universite: nomUniversite ? { id, nom: nomUniversite } : null,
            }
          : current,
      );
      setUniversiteSaved(true);
    } catch (e) {
      showError(extractErrorMessage(e, "L'enregistrement a échoué."));
    }
  }

  // Second point d'entree du choix "je ne suis pas etudiant". Il n'existait
  // qu'a l'inscription (ChoisirUniversiteScreen) : quiconque avait touche
  // "Passer pour l'instant" ne pouvait plus jamais se declarer chauffeur, et
  // l'accueil lui reclamait une universite indefiniment. Le choix est
  // reversible : rechoisir une universite ici restaure le role etudiant
  // (voir UsersService.updateProfil).
  async function handleDeclarerChauffeur() {
    setChauffeurPending(true);
    try {
      await declarerChauffeur();
      setProfile((current) =>
        current ? { ...current, role: 'chauffeur' } : current,
      );
    } catch (e) {
      showError(extractErrorMessage(e, "L'enregistrement a échoué."));
    } finally {
      setChauffeurPending(false);
    }
  }

  async function handleSave() {
    if (!nom.trim()) {
      setSaveError('Ton nom ne peut pas être vide.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await updateNom(nom.trim());
      setProfile((current) => (current ? { ...current, nom: nom.trim() } : current));
      setSaved(true);
    } catch (e) {
      showError(extractErrorMessage(e, "L'enregistrement a échoué."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Mes informations" onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </View>
    );
  }

  if (loadError || !profile) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Mes informations" onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <ErrorState message={loadError ?? 'Profil introuvable.'} onRetry={load} />
        </View>
      </View>
    );
  }

  const tag = statutTag(profile.conducteurStatut);
  const nomModifie = nom.trim() !== (profile.nom ?? '');

  return (
    <View style={styles.container}>
      <ScreenHeader title="Mes informations" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        <Field label="Ton nom">
          <Input
            placeholder="Ex. Kouassi"
            value={nom}
            onChangeText={(value) => {
              setNom(value);
              setSaved(false);
            }}
            autoCapitalize="words"
          />
        </Field>

        {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
        {saved ? <Text style={styles.success}>Nom enregistré ✓</Text> : null}

        <Button
          title="Enregistrer"
          block
          loading={saving}
          disabled={!nomModifie}
          onPress={() => void handleSave()}
        />

        <View style={styles.universiteBlock}>
          <PickerField
            label="Ton université"
            placeholder="Choisir mon université"
            selectedLabel={profile.universite?.nom ?? null}
            options={universites.map((u) => ({ id: u.id, label: u.nom, sublabel: u.commune }))}
            onSelect={(id) => void handleChoisirUniversite(id)}
            searchable
          />
          {universiteSaved ? (
            <Text style={styles.success}>Université mise à jour ✓</Text>
          ) : null}
          {profile.role === 'chauffeur' ? (
            <MutedText style={styles.hint}>
              Tu es inscrit comme chauffeur, donc rattaché à aucune université.
              Choisis-en une ci-dessus si tu es aussi étudiant.
            </MutedText>
          ) : profile.role === 'etudiant' ? (
            <Button
              title="Je ne suis pas étudiant, je suis chauffeur"
              variant="ghost"
              block
              loading={chauffeurPending}
              onPress={() => void handleDeclarerChauffeur()}
            />
          ) : null}
        </View>

        <View style={styles.readonlyBlock}>
          <Field label="Téléphone">
            <View style={styles.readonly}>
              <Text style={styles.readonlyText}>{profile.telephone}</Text>
            </View>
          </Field>
          <MutedText style={styles.hint}>
            C'est ton identifiant de connexion : il ne peut pas être modifié
            ici.
          </MutedText>
        </View>

        <Field label="Note reçue">
          <TouchableOpacity
            style={styles.readonly}
            onPress={() =>
              navigation.navigate('Avis', {
                userId: profile.id,
                nom: nom.trim() || 'Moi',
              })
            }
          >
            <Text style={styles.readonlyText}>
              {profile.note !== null
                ? `★ ${profile.note.toFixed(1)} (${profile.nombreNotations} avis) · Voir les avis`
                : 'Pas encore noté'}
            </Text>
          </TouchableOpacity>
        </Field>

        <Field label="Statut">
          <View style={styles.tagRow}>
            <Tag variant={tag.variant} label={tag.label} />
          </View>
        </Field>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  universiteBlock: {
    marginTop: 22,
  },
  readonlyBlock: {
    marginTop: 22,
  },
  readonly: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    opacity: 0.75,
  },
  readonlyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.text,
  },
  tagRow: {
    flexDirection: 'row',
  },
  hint: {
    fontSize: 11.5,
    marginTop: -6,
    marginBottom: 10,
  },
  error: {
    color: colors.accent,
    fontSize: 13,
    marginBottom: 8,
  },
  success: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 13,
    color: colors.text,
    marginBottom: 8,
  },
});
