import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AxiosError } from 'axios';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainTabsParamList, RootStackParamList } from '../navigation/types';
import { colors, fonts, shadows } from '../theme';
import {
  annulerDemande,
  getProfile,
  listerDemandesDisponibles,
  accepterDemande,
  type DemandeDisponible,
  listCommunes,
  listerDemandes,
  listerMesDemandes,
  listerNotationsEnAttente,
  listPointsInteret,
  listTrajets,
  listUniversites,
  quitterDemande,
  rejoindreDemande,
  updateUniversite,
  Commune,
  Demande,
  MesDemandesDemande,
  NotationEnAttente,
  PointInteret,
  Trajet,
  Universite,
} from '../api/client';
import { formatPlacesRestantes } from '../utils/places';
import { getDisplayName } from '../utils/profile';
import { nearestCommune } from '../utils/nearestCommune';
import { DemandeDisponibleCard } from '../components/DemandeDisponibleCard';
import { BoutonRemonter, useRemonterEnHaut } from '../components/BoutonRemonter';
import { getTrajetsIgnores, ignorerTrajet } from '../utils/notationsIgnorees';
import { gererSuspension } from '../utils/suspension';
import {
  getDemandesAnnuleesVues,
  marquerDemandeAnnuleeVue,
} from '../utils/demandesAnnuleesVues';
import { useRefreshOnForeground } from '../hooks/useRefreshOnForeground';
import { BurgerButton } from '../components/BurgerButton';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorState } from '../components/ErrorState';
import { LocationBanner } from '../components/LocationBanner';
import { showError } from '../components/Toast';
import { ArrowRightIcon, ChevronDownIcon, CloseIcon, PencilIcon, PinIcon, PlusIcon, StarIcon } from '../components/icons';
import { RejoindrePositionModal } from '../components/RejoindrePositionModal';
import { SearchableListModal } from '../components/SearchableListModal';
import { SegmentedControl } from '../components/SegmentedControl';
import { Tag } from '../components/Tag';
import { H4, H5, MutedText } from '../components/Typography';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabsParamList, 'Accueil'>,
  NativeStackScreenProps<RootStackParamList>
>;

interface PickerOption {
  id: string;
  label: string;
}

// Puce "commune de depart" de la barre compacte -- liste courte (14
// communes), pas de recherche (voir PickerField.searchable, reserve aux
// listes longues). L'universite, elle, ne passe plus par ce mecanisme : elle
// vient du profil (voir plus bas), modifiable via SearchableListModal.
function CommuneChip({
  label,
  options,
  onSelect,
}: {
  label: string | null;
  options: PickerOption[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <>
      <TouchableOpacity style={styles.chip} onPress={() => setOpen(true)}>
        <PinIcon size={14} color={colors.text} />
        <Text style={styles.chipText} numberOfLines={1}>
          {label ?? 'Ma commune'}
        </Text>
        <ChevronDownIcon size={11} color={colors.textMuted} />
      </TouchableOpacity>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View
          style={[
            styles.modalContainer,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom },
          ]}
        >
          <Text style={styles.modalTitle}>Ta commune de départ</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  onSelect(item.id);
                  setOpen(false);
                }}
              >
                <Text style={styles.modalItemText}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.modalClose} onPress={() => setOpen(false)}>
            <Text style={styles.modalCloseText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export default function AccueilScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [universites, setUniversites] = useState<Universite[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  // L'universite vient desormais du profil (renseignee une fois, voir
  // ChoisirUniversiteScreen) au lieu d'etre re-choisie a chaque visite --
  // profileLoaded distingue "pas encore su" de "confirme absente", pour ne
  // pas flasher l'etat "Choisis ton universite" le temps du premier fetch.
  const [universiteId, setUniversiteId] = useState<string | null>(null);
  const [universiteNom, setUniversiteNom] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [universiteModalOpen, setUniversiteModalOpen] = useState(false);
  const [communeId, setCommuneId] = useState<string | null>(null);
  const [trajets, setTrajets] = useState<Trajet[]>([]);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loadingTrajets, setLoadingTrajets] = useState(false);
  const [loadingDemandes, setLoadingDemandes] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [presDeMoi, setPresDeMoi] = useState(false);
  const [rejoindrePendingId, setRejoindrePendingId] = useState<string | null>(
    null,
  );
  const [joinModalDemandeId, setJoinModalDemandeId] = useState<string | null>(
    null,
  );
  const [mesDemandes, setMesDemandes] = useState<MesDemandesDemande[]>([]);
  const [annulerPendingId, setAnnulerPendingId] = useState<string | null>(null);
  const [monId, setMonId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [conducteurStatut, setConducteurStatut] = useState<string | null>(null);
  const [demandesAAccepter, setDemandesAAccepter] = useState<DemandeDisponible[]>([]);
  const [chargementAAccepter, setChargementAAccepter] = useState(false);
  const [accepterPendingId, setAccepterPendingId] = useState<string | null>(null);
  const remonterConducteur = useRemonterEnHaut<DemandeDisponible>();
  // Deux instances distinctes : les deux listes ne s'affichent jamais en meme
  // temps, mais chacune garde sa propre position de defilement.
  const remonterFeed = useRemonterEnHaut<FeedItem>();
  // Menu du "+" pour un compte "les deux" : il peut agir dans les deux sens,
  // le bouton doit donc lui demander lequel plutot que d'en choisir un.
  const [menuCreationOuvert, setMenuCreationOuvert] = useState(false);

  useEffect(() => {
    getProfile()
      .then((profile) => {
        setDisplayName(
          getDisplayName(profile.nom, profile.prenom, profile.telephone),
        );
        setUniversiteId(profile.universiteId);
        setUniversiteNom(profile.universite?.nom ?? null);
        setMonId(profile.id);
        setRole(profile.role);
        setConducteurStatut(profile.conducteurStatut);
      })
      .catch(() => undefined)
      .finally(() => setProfileLoaded(true));
  }, []);

  // Vue conducteur : les demandes de SA commune, chargees directement sur
  // l'accueil. Il n'a pas d'universite, donc aucun filtre dessus -- toutes
  // les universites de la commune l'interessent.
  const estConducteur = conducteurStatut === 'valide';
  const chargerDemandesAAccepter = useCallback(async () => {
    if (!communeId || !estConducteur) return;
    setChargementAAccepter(true);
    try {
      setDemandesAAccepter(
        await listerDemandesDisponibles(communeId, universiteId ?? undefined),
      );
    } catch {
      // Silencieux : l'accueil affiche deja d'autres contenus, une erreur
      // bloquante ici masquerait tout le reste.
    } finally {
      setChargementAAccepter(false);
    }
  }, [communeId, universiteId, estConducteur]);

  useEffect(() => {
    void chargerDemandesAAccepter();
  }, [chargerDemandesAAccepter]);

  async function handleAccepterDemande(demandeId: string) {
    setAccepterPendingId(demandeId);
    try {
      await accepterDemande(demandeId);
      navigation.navigate('MesTrajetsConducteur');
    } catch (e) {
      showError(extractErrorMessage(e, "L'acceptation a échoué."));
      void chargerDemandesAAccepter();
    } finally {
      setAccepterPendingId(null);
    }
  }

  function handleChoisirUniversite(id: string) {
    const nom = universites.find((u) => u.id === id)?.nom ?? null;
    setUniversiteId(id);
    setUniversiteNom(nom);
    setUniversiteModalOpen(false);
    updateUniversite(id).catch(() => undefined);
  }

  const [pointsInteret, setPointsInteret] = useState<PointInteret[]>([]);

  const loadReferentiel = useCallback(async () => {
    const [universitesData, communesData, pointsInteretData] = await Promise.all([
      listUniversites(),
      listCommunes(),
      listPointsInteret(),
    ]);
    setUniversites(universitesData);
    setCommunes(communesData);
    setPointsInteret(pointsInteretData);
  }, []);

  useEffect(() => {
    void loadReferentiel();
  }, [loadReferentiel]);

  // Devine la commune de depart depuis le GPS (si la permission est deja
  // accordee) au lieu de partir sur un champ vide -- reste modifiable par
  // l'utilisateur ensuite, ce n'est qu'un pre-remplissage. On ne redemande
  // jamais la permission ici : LocationBanner s'en charge deja si besoin.
  useEffect(() => {
    if (communeId || pointsInteret.length === 0) return;
    let cancelled = false;
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      const position = await Location.getCurrentPositionAsync({}).catch(() => null);
      if (!position || cancelled) return;
      const commune = nearestCommune(
        position.coords.latitude,
        position.coords.longitude,
        pointsInteret,
      );
      if (commune && !cancelled) setCommuneId((current) => current ?? commune.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [communeId, pointsInteret]);

  const loadTrajets = useCallback(
    async (lat?: number, lng?: number) => {
      if (!universiteId || !communeId) return;
      setLoadingTrajets(true);
      try {
        setTrajets(await listTrajets(universiteId, communeId, lat, lng));
        setFeedError(null);
      } catch (e) {
        setFeedError(extractErrorMessage(e, 'Impossible de charger les trajets.'));
      } finally {
        setLoadingTrajets(false);
      }
    },
    [universiteId, communeId],
  );

  useEffect(() => {
    void loadTrajets();
  }, [loadTrajets]);

  const loadDemandes = useCallback(async () => {
    if (!universiteId || !communeId) return;
    setLoadingDemandes(true);
    try {
      setDemandes(await listerDemandes(universiteId, communeId));
      setFeedError(null);
    } catch (e) {
      setFeedError(extractErrorMessage(e, 'Impossible de charger les demandes.'));
    } finally {
      setLoadingDemandes(false);
    }
  }, [universiteId, communeId]);

  useEffect(() => {
    void loadDemandes();
  }, [loadDemandes]);

  const refreshFeed = useCallback(() => {
    void loadTrajets();
    void loadDemandes();
  }, [loadTrajets, loadDemandes]);

  useRefreshOnForeground(refreshFeed);

  // Sans ca, revenir sur Accueil apres avoir rejoint une demande (ecran
  // PointDeRegroupement) laissait la carte du feed principal figee sur son
  // etat d'avant (dejaRejoint encore a false) -- le bouton "Rejoindre"
  // restait actif et une 2e tentative de rejoindre la meme demande semblait
  // possible alors qu'elle etait deja rejointe.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', refreshFeed);
    return unsubscribe;
  }, [navigation, refreshFeed]);

  // Fusion visuelle (pas de fusion des modeles) : "trajets" (deja confirmes,
  // chauffeur+vehicule+prix garantis) et "demandes" (en attente d'un
  // chauffeur) sont affiches dans un seul flux trie par heure de depart,
  // avec un badge distinct par carte -- separer les deux dans 2 onglets
  // portait a confusion (retour utilisateur direct).
  type FeedItem =
    | { kind: 'trajet'; id: string; heure: string; trajet: Trajet }
    | { kind: 'demande'; id: string; heure: string; demande: Demande };

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [
      ...trajets.map((t) => ({
        kind: 'trajet' as const,
        id: `t-${t.id}`,
        heure: t.heure,
        trajet: t,
      })),
      ...demandes.map((d) => ({
        kind: 'demande' as const,
        id: `d-${d.id}`,
        heure: d.heure,
        demande: d,
      })),
    ];
    items.sort((a, b) => {
      if (presDeMoi) {
        const da = a.kind === 'trajet' ? a.trajet.distanceKm ?? Infinity : Infinity;
        const db = b.kind === 'trajet' ? b.trajet.distanceKm ?? Infinity : Infinity;
        if (da !== db) return da - db;
      }
      return new Date(a.heure).getTime() - new Date(b.heure).getTime();
    });
    return items;
  }, [trajets, demandes, presDeMoi]);

  // Independant du filtre universite/commune -- les demandes que j'ai
  // creees/rejointes restent visibles meme si je change de filtre ensuite.
  const loadMesDemandes = useCallback(() => {
    listerMesDemandes()
      .then(async (data) => {
        // Pas de notification push reelle : quand le createur annule une
        // demande, un participant ne l'apprenait jusqu'ici qu'en la voyant
        // disparaitre silencieusement de cette liste. Un toast (affiche une
        // seule fois par demande, voir demandesAnnuleesVues) comble ce trou.
        const vues = await getDemandesAnnuleesVues();
        // monId pas encore connu (getProfile pas encore resolu) : on attend
        // plutot que de risquer de notifier a tort le createur de sa propre
        // annulation (createurId !== null serait toujours vrai).
        const nouvellesAnnulees = monId
          ? data.filter(
              (d) => d.statut === 'annulee' && d.createurId !== monId && !vues.has(d.id),
            )
          : [];
        for (const d of nouvellesAnnulees) {
          showError(
            `Le créateur a annulé la demande ${d.commune.nom} → ${d.universite.nom}.`,
          );
          void marquerDemandeAnnuleeVue(d.id);
        }

        setMesDemandes(
          data.filter((d) => d.statut === 'ouverte' || d.statut === 'quota_atteint'),
        );
      })
      .catch(() => undefined);
  }, [monId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadMesDemandes);
    return unsubscribe;
  }, [navigation, loadMesDemandes]);

  // Rappel "a noter" : sans lui, les moyennes reposent sur trop peu d'avis
  // pour etre fiables (personne ne pense a revenir noter spontanement).
  const [notationsEnAttente, setNotationsEnAttente] = useState<
    NotationEnAttente[]
  >([]);
  const loadNotationsEnAttente = useCallback(() => {
    Promise.all([listerNotationsEnAttente(), getTrajetsIgnores()])
      .then(([notations, ignores]) =>
        setNotationsEnAttente(
          notations.filter((n) => !ignores.has(n.trajetId)),
        ),
      )
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadNotationsEnAttente);
    return unsubscribe;
  }, [navigation, loadNotationsEnAttente]);

  // Noter n'est jamais obligatoire -- ce rappel doit pouvoir etre ignore
  // durablement (sinon il revient a chaque passage sur Accueil tant que le
  // trajet n'est pas note, ce qui donne l'impression d'un blocage).
  function handleIgnorerNotation(trajetId: string) {
    setNotationsEnAttente((prev) => prev.filter((n) => n.trajetId !== trajetId));
    void ignorerTrajet(trajetId);
  }

  async function handleAnnulerDemande(demandeId: string) {
    setAnnulerPendingId(demandeId);
    try {
      const resultat = await annulerDemande(demandeId);
      if (gererSuspension(resultat.suspenduJusqua)) {
        return;
      }
      loadMesDemandes();
      void loadDemandes();
    } catch (e) {
      showError(extractErrorMessage(e, "L'annulation a échoué."));
    } finally {
      setAnnulerPendingId(null);
    }
  }

  // Annuler une demande que d'autres ont rejointe compte comme une annulation
  // tardive (2e = suspension). L'avertissement evite que le createur decouvre
  // la sanction apres coup -- meme principe que l'annulation tardive d'une
  // reservation.
  function handleAnnulerDemandePress(demandeId: string, aDesParticipants: boolean) {
    if (!aDesParticipants) {
      void handleAnnulerDemande(demandeId);
      return;
    }
    Alert.alert(
      'Des étudiants comptent sur toi',
      "D'autres ont déjà rejoint cette demande. L'annuler la supprime pour eux et compte comme une annulation tardive : à la 2e, ton compte est suspendu trois semaines.",
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: 'Annuler quand même',
          style: 'destructive',
          onPress: () => void handleAnnulerDemande(demandeId),
        },
      ],
    );
  }

  async function handleQuitterDemande(demandeId: string) {
    setAnnulerPendingId(demandeId);
    try {
      await quitterDemande(demandeId);
      loadMesDemandes();
      void loadDemandes();
    } catch (e) {
      showError(extractErrorMessage(e, "Tu n'as pas pu quitter cette demande."));
    } finally {
      setAnnulerPendingId(null);
    }
  }

  function handleRejoindre(demandeId: string) {
    setJoinModalDemandeId(demandeId);
  }

  async function handleConfirmRejoindre(lat: number, lng: number) {
    const demandeId = joinModalDemandeId;
    if (!demandeId) return;
    setRejoindrePendingId(demandeId);
    try {
      await rejoindreDemande(demandeId, lat, lng);
      setJoinModalDemandeId(null);
      navigation.navigate('PointDeRegroupement', { demandeId });
    } catch (e) {
      setJoinModalDemandeId(null);
      showError(extractErrorMessage(e, "La demande n'a pas pu être rejointe."));
    } finally {
      setRejoindrePendingId(null);
    }
  }

  async function handlePresDeMoiChange(value: string) {
    if (value === 'tous') {
      setPresDeMoi(false);
      void loadTrajets();
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      showError('Autorisation de localisation refusée.');
      return;
    }

    setPresDeMoi(true);
    const position = await Location.getCurrentPositionAsync({});
    void loadTrajets(position.coords.latitude, position.coords.longitude);
  }

  const communeLabel = communes.find((c) => c.id === communeId)?.nom ?? null;
  const ready = Boolean(universiteId && communeId);

  return (
    <View style={styles.container}>
      <LocationBanner />
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTitleRow}>
          <H4>Salut{displayName ? `, ${displayName}` : ''}</H4>
          <BurgerButton onPress={() => navigation.navigate('Profil')} />
        </View>

        {/* Un conducteur n'a pas d'universite : il ne lui reste que la commune,
            seule cle de son feed. Elle est pre-remplie depuis sa position et
            reste modifiable ici, pour aller voir les demandes d'ailleurs. */}
        {role === 'chauffeur' ? (
          <View style={styles.compactBar}>
            <CommuneChip
              label={communeLabel}
              options={communes.map((c) => ({ id: c.id, label: c.nom }))}
              onSelect={setCommuneId}
            />
          </View>
        ) : universiteId ? (
          <View style={styles.compactBar}>
            <CommuneChip
              label={communeLabel}
              options={communes.map((c) => ({ id: c.id, label: c.nom }))}
              onSelect={setCommuneId}
            />
            <View style={styles.compactDivider} />
            <TouchableOpacity
              style={styles.chip}
              onPress={() => setUniversiteModalOpen(true)}
            >
              <Text style={styles.chipText} numberOfLines={1}>
                {universiteNom ?? 'Ton université'}
              </Text>
              <PencilIcon size={12} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* Role "les deux" : etudiant ET conducteur valide. Cette personne
          alterne selon les jours -- passagere le matin, conductrice le soir.
          Un accueil purement passager l'obligeait a passer par le Profil,
          un ecran de reglages, pour la moitie de ses usages. Le flux passager
          reste dessous : on ajoute une bascule, on ne remplace rien. */}
      {conducteurStatut === 'valide' && role !== 'chauffeur' ? (
        <View style={styles.actionsConducteur}>
          {/* "Publier" a quitte cette rangee : il est desormais dans le menu
              du "+", et l'afficher aux deux endroits n'aurait fait que
              dupliquer la meme action. */}
          <Button
            title="Voir les demandes à accepter"
            variant="secondary"
            style={styles.actionConducteur}
            onPress={() => navigation.navigate('DemandesDisponibles')}
          />
        </View>
      ) : null}

      {notationsEnAttente.length > 0 ? (
        <View style={styles.rappelBanner}>
          <TouchableOpacity
            style={styles.rappelTapZone}
            onPress={() => {
              const [premier, ...reste] = notationsEnAttente;
              setNotationsEnAttente(reste);
              navigation.navigate('Notation', premier);
            }}
          >
            <Text style={styles.rappelText}>
              Tu as {notationsEnAttente.length} trajet
              {notationsEnAttente.length > 1 ? 's' : ''} à noter
            </Text>
            <ArrowRightIcon color={colors.background} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rappelClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => handleIgnorerNotation(notationsEnAttente[0].trajetId)}
          >
            <CloseIcon size={13} color={colors.background} />
          </TouchableOpacity>
        </View>
      ) : null}

      {mesDemandes.length > 0 ? (
        <View style={styles.mesDemandesSection}>
          <H5>Mes demandes en cours</H5>
          {mesDemandes.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() =>
                navigation.navigate('PointDeRegroupement', { demandeId: item.id })
              }
            >
              <Card style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>
                    {item.commune.nom} → {item.universite.nom}
                  </Text>
                  <Tag
                    variant={item.statut === 'quota_atteint' ? 'accent' : 'neutral'}
                    label={
                      item.statut === 'quota_atteint'
                        ? "En attente d'un conducteur"
                        : 'En attente de participants'
                    }
                  />
                </View>
                <MutedText>
                  {item.createurId === monId ? 'Créée par toi' : 'Tu as rejoint cette demande'}
                  {' · '}
                  {formatPlacesRestantes(item.placesRecherchees, item.placesConfirmees)}
                </MutedText>
                {item.createurId === monId ? (
                  <Button
                    title="Annuler cette demande"
                    variant="ghost"
                    loading={annulerPendingId === item.id}
                    onPress={() =>
                      handleAnnulerDemandePress(
                        item.id,
                        item.placesConfirmees > 1,
                      )
                    }
                  />
                ) : (
                  <Button
                    title="Quitter cette demande"
                    variant="ghost"
                    loading={annulerPendingId === item.id}
                    onPress={() => void handleQuitterDemande(item.id)}
                  />
                )}
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {ready ? (
        <View style={styles.body}>
          <View style={styles.segRow}>
            <SegmentedControl
              options={[
                { value: 'tous', label: 'Tous' },
                { value: 'pres', label: 'Près de moi' },
              ]}
              value={presDeMoi ? 'pres' : 'tous'}
              onChange={(value) => void handlePresDeMoiChange(value)}
            />
          </View>

          {(loadingTrajets || loadingDemandes) && feed.length === 0 ? (
            <ActivityIndicator color={colors.accent} style={styles.loader} />
          ) : feedError && feed.length === 0 ? (
            <ErrorState message={feedError} onRetry={refreshFeed} />
          ) : (
            <FlatList
              ref={remonterFeed.listRef}
              onScroll={remonterFeed.onScroll}
              scrollEventThrottle={16}
              data={feed}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl
                  refreshing={loadingTrajets || loadingDemandes}
                  onRefresh={refreshFeed}
                  tintColor={colors.accent}
                />
              }
              ListHeaderComponent={
                feedError ? <Text style={styles.error}>{feedError}</Text> : null
              }
              ListEmptyComponent={
                <MutedText style={styles.empty}>
                  Aucun trajet ni demande pour le moment.
                </MutedText>
              }
              renderItem={({ item }) =>
                item.kind === 'trajet' ? (
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate('TrajetDetail', { trajetId: item.trajet.id })
                    }
                  >
                    <Card style={styles.card}>
                      <View style={styles.rowBetween}>
                        <View style={styles.tagRow}>
                          {/* Le badge porte desormais SEUL la difference
                              entre les deux modes : le verbe d'action est
                              identique partout ("Je participe"). */}
                          <Tag variant="accent" label="Conducteur confirmé" />
                          {item.trajet.conducteur.verifie ? (
                            <Tag variant="outline" label="Papiers vérifiés" />
                          ) : null}
                        </View>
                        <Text style={styles.time}>
                          {new Date(item.trajet.heure).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                      <View style={styles.titleRow}>
                        <H5
                          style={styles.titleText}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {item.trajet.pointDeRdv.nom}
                        </H5>
                        <ArrowRightIcon color={colors.text} />
                        <H5
                          style={styles.titleText}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {item.trajet.universite.nom}
                        </H5>
                      </View>
                      <View style={styles.metaRow}>
                        <MutedText style={styles.metaText}>
                          {item.trajet.conducteur.nom ?? item.trajet.conducteur.prenom ?? 'Conducteur'}
                        </MutedText>
                        {item.trajet.conducteur.note !== null ? (
                          <View style={styles.metaInline}>
                            <StarIcon />
                            <MutedText style={styles.metaText}>
                              {item.trajet.conducteur.note.toFixed(1)} (
                              {item.trajet.conducteur.nombreNotations})
                            </MutedText>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.rowBetween}>
                        <MutedText>{item.trajet.places} places</MutedText>
                        {/* Montant reellement du par le passager, identique a
                            celui des cartes de demande -- avant, c'etait le
                            prix TOTAL de la course qui s'affichait ici. */}
                        <Text style={styles.price}>
                          {item.trajet.cotisation} FCFA/pers.
                        </Text>
                      </View>
                      {item.trajet.dejaReserve ? (
                        <Button
                          title="Tu participes déjà"
                          variant="secondary"
                          block
                          disabled
                        />
                      ) : (
                        <Button
                          title="Je participe"
                          block
                          onPress={() =>
                            navigation.navigate('TrajetDetail', { trajetId: item.trajet.id })
                          }
                        />
                      )}
                    </Card>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate('PointDeRegroupement', {
                        demandeId: item.demande.id,
                      })
                    }
                  >
                    <Card style={styles.card}>
                      <View style={styles.rowBetween}>
                        <Tag variant="outline" label="Groupe en formation" />
                        <Text style={styles.time}>
                          {new Date(item.demande.heure).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                      <View style={styles.titleRow}>
                        <H5
                          style={styles.titleText}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {communeLabel ?? 'Ta commune'}
                        </H5>
                        <ArrowRightIcon color={colors.text} />
                        <H5
                          style={styles.titleText}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {universiteNom ?? 'Ton université'}
                        </H5>
                      </View>
                      <MutedText>
                        {item.demande.placesRestantes > 0
                          ? `${item.demande.placesRestantes} place${item.demande.placesRestantes > 1 ? 's' : ''} restante${item.demande.placesRestantes > 1 ? 's' : ''}`
                          : 'Groupe complet'}{' '}
                        · {item.demande.cotisation} FCFA/pers.
                      </MutedText>
                      {item.demande.dejaRejoint ? (
                        <Button
                          title="Tu participes déjà"
                          variant="secondary"
                          block
                          disabled
                        />
                      ) : (
                        <Button
                          title="Je participe"
                          block
                          loading={rejoindrePendingId === item.demande.id}
                          onPress={() => void handleRejoindre(item.demande.id)}
                        />
                      )}
                    </Card>
                  </TouchableOpacity>
                )
              }
            />
          )}
        </View>
      ) : !profileLoaded ? (
        <View style={styles.body}>
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        </View>
      ) : role === 'chauffeur' ? (
        // Un conducteur n'a pas d'universite : le flux passager ne le concerne
        // pas. On lui montre a la place les demandes de SA commune, celle
        // memorisee a l'inscription -- il n'a plus a la ressaisir ni a passer
        // par un autre ecran. L'affichage depend de l'etat de son dossier :
        // lui promettre des demandes a accepter avant validation lui
        // annoncerait un acces qu'il n'a pas encore.
        <View style={[styles.body, conducteurStatut !== 'valide' && styles.bodyChauffeur]}>
          {conducteurStatut === 'en attente' ? (
            <MutedText style={styles.empty}>
              Tes documents sont en cours de vérification. Dès qu'un
              administrateur les valide, tu pourras publier des trajets et
              accepter des demandes. Tu recevras une notification.
            </MutedText>
          ) : conducteurStatut === 'refuse' ? (
            <>
              <MutedText style={styles.empty}>
                Ton dossier n'a pas été validé. Tu peux renvoyer des documents
                plus lisibles pour être vérifié à nouveau.
              </MutedText>
              <Button
                title="Renvoyer mes documents"
                block
                onPress={() => navigation.navigate('InscriptionConducteur')}
              />
            </>
          ) : conducteurStatut !== 'valide' ? (
            <>
              <MutedText style={styles.empty}>
                Pour commencer à conduire, envoie ton permis et le matricule de
                ton véhicule. Un administrateur vérifie ton dossier sous 48h.
              </MutedText>
              <Button
                title="Envoyer mes documents"
                block
                onPress={() => navigation.navigate('InscriptionConducteur')}
              />
            </>
          ) : !communeId ? (
            <MutedText style={styles.empty}>
              Choisis ta commune pour voir les étudiants qui cherchent un
              conducteur près de toi.
            </MutedText>
          ) : (
            <FlatList
              ref={remonterConducteur.listRef}
              onScroll={remonterConducteur.onScroll}
              scrollEventThrottle={16}
              data={demandesAAccepter}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl
                  refreshing={chargementAAccepter}
                  onRefresh={() => void chargerDemandesAAccepter()}
                  tintColor={colors.accent}
                />
              }
              ListHeaderComponent={
                <MutedText style={styles.count}>
                  {demandesAAccepter.length} demande
                  {demandesAAccepter.length > 1 ? 's' : ''} au départ de{' '}
                  {communeLabel ?? 'ta commune'}
                </MutedText>
              }
              ListEmptyComponent={
                <MutedText style={styles.empty}>
                  Aucune demande pour l'instant. Tu peux publier un trajet avec
                  le bouton +.
                </MutedText>
              }
              renderItem={({ item }) => (
                <DemandeDisponibleCard
                  demande={item}
                  pending={accepterPendingId === item.id}
                  onAccepter={() => void handleAccepterDemande(item.id)}
                />
              )}
            />
          )}
        </View>
      ) : !universiteId ? (
        <View style={styles.body}>
          <MutedText style={styles.empty}>
            Choisis ton université pour voir les trajets et demandes qui te
            concernent.
          </MutedText>
          <Button
            title="Choisir mon université"
            block
            onPress={() => setUniversiteModalOpen(true)}
          />
        </View>
      ) : (
        <View style={styles.body}>
          <MutedText style={styles.empty}>
            Choisis ta commune de départ pour voir les trajets et demandes
            disponibles.
          </MutedText>
        </View>
      )}

      <SearchableListModal
        visible={universiteModalOpen}
        title="Ton université"
        searchPlaceholder="Rechercher ton université…"
        options={universites.map((u) => ({ id: u.id, label: u.nom, sublabel: u.commune }))}
        onSelect={handleChoisirUniversite}
        onClose={() => setUniversiteModalOpen(false)}
      />

      <BoutonRemonter
        visible={role === 'chauffeur' ? remonterConducteur.visible : remonterFeed.visible}
        onPress={role === 'chauffeur' ? remonterConducteur.remonter : remonterFeed.remonter}
      />

      {/* Meme bouton "+" pour tout le monde, seule l'action change : creer une
          demande quand on cherche une place, publier un trajet quand on
          conduit. Un conducteur retrouve ainsi le geste qu'il connait deja. */}
      {role === 'chauffeur' ? (
        conducteurStatut === 'valide' ? (
          <TouchableOpacity
            style={styles.fab}
            onPress={() => navigation.navigate('PublierTrajet')}
          >
            <PlusIcon />
          </TouchableOpacity>
        ) : null
      ) : universiteId ? (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            // Un compte "les deux" peut aussi bien chercher une place que
            // proposer la sienne : on lui pose la question au lieu de
            // trancher a sa place.
            if (conducteurStatut === 'valide') {
              setMenuCreationOuvert(true);
              return;
            }
            navigation.navigate('CreerDemande', {
              universiteId,
              communeId: communeId ?? undefined,
            });
          }}
        >
          <PlusIcon />
        </TouchableOpacity>
      ) : null}

      <Modal
        visible={menuCreationOuvert}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuCreationOuvert(false)}
      >
        <TouchableOpacity
          style={styles.menuFond}
          activeOpacity={1}
          onPress={() => setMenuCreationOuvert(false)}
        >
          <View style={[styles.menuFeuille, { paddingBottom: insets.bottom + 20 }]}>
            <H5 style={styles.menuTitre}>Tu veux…</H5>
            <Button
              title="Chercher une place (créer une demande)"
              block
              onPress={() => {
                setMenuCreationOuvert(false);
                navigation.navigate('CreerDemande', {
                  universiteId: universiteId ?? undefined,
                  communeId: communeId ?? undefined,
                });
              }}
            />
            <Button
              title="Proposer ma voiture (publier un trajet)"
              variant="secondary"
              block
              onPress={() => {
                setMenuCreationOuvert(false);
                navigation.navigate('PublierTrajet');
              }}
            />
            <Button
              title="Annuler"
              variant="ghost"
              block
              onPress={() => setMenuCreationOuvert(false)}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {joinModalDemandeId && communeId ? (
        <RejoindrePositionModal
          visible
          communeId={communeId}
          submitting={rejoindrePendingId === joinModalDemandeId}
          onCancel={() => setJoinModalDemandeId(null)}
          onConfirm={(lat, lng) => void handleConfirmRejoindre(lat, lng)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.divider,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  compactBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  compactDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.divider,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  chipText: {
    flex: 1,
    fontFamily: fonts.headingSemiBold,
    fontSize: 13.5,
    color: colors.text,
  },
  modalTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
    marginBottom: 14,
  },
  segRow: {
    marginBottom: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalItemText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  modalClose: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalCloseText: {
    fontFamily: fonts.headingSemiBold,
    color: colors.accent,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    position: 'relative',
  },
  bodyChauffeur: {
    gap: 10,
  },
  count: {
    fontSize: 12.5,
    marginBottom: 10,
  },
  menuFond: {
    flex: 1,
    backgroundColor: 'rgba(32,30,29,0.45)',
    justifyContent: 'flex-end',
  },
  menuFeuille: {
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 10,
  },
  menuTitre: {
    marginBottom: 4,
  },
  actionsConducteur: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  actionConducteur: {
    // Padding reduit : deux boutons cote a cote, le libelle doit tenir sur
    // une ligne meme sur les petits ecrans.
    flex: 1,
    paddingHorizontal: 8,
  },
  loader: {
    marginTop: 24,
  },
  list: {
    paddingVertical: 16,
    paddingBottom: 80,
    gap: 12,
  },
  card: {
    marginBottom: 0,
  },
  cardTitle: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 14.5,
    color: colors.text,
  },
  mesDemandesSection: {
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 10,
  },
  rappelBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.text,
  },
  rappelTapZone: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rappelText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 13,
    color: colors.background,
  },
  rappelClose: {
    marginLeft: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
  },
  time: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 13,
    color: colors.text,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
  },
  price: {
    fontFamily: fonts.headingSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  empty: {
    textAlign: 'center',
    marginTop: 24,
  },
  error: {
    color: colors.accent,
    fontSize: 13,
    marginBottom: 8,
  },
});
