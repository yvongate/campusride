import axios, { AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import {
  resetToCompteSuspendu,
  resetToConnexion,
} from '../navigation/navigationRef';

const baseURL = process.env.EXPO_PUBLIC_API_URL;

export const apiClient = axios.create({
  baseURL,
  timeout: 10000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Un 401 en cours de session (token expire ou revoque -- pas au login, /auth/*
// est exclu car un code OTP errone renvoie aussi 401) signifie que la session
// n'est plus valide : on efface le token et on renvoie vers Connexion au lieu
// de laisser chaque ecran echouer silencieusement avec une erreur brute.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (
      error instanceof AxiosError &&
      error.response?.status === 401 &&
      !error.config?.url?.startsWith('/auth/')
    ) {
      await SecureStore.deleteItemAsync('accessToken');
      resetToConnexion();
    }
    // Compte suspendu : le token reste valide (d'ou un 403 et non un 401), et
    // on GARDE la session -- c'est elle qui donne acces au formulaire de
    // recours. Deconnecter ici enfermerait la personne dehors trois semaines.
    const donnees = (error as AxiosError<{ code?: string; suspenduJusqua?: string }>)
      .response?.data;
    if (
      error instanceof AxiosError &&
      error.response?.status === 403 &&
      donnees?.code === 'COMPTE_SUSPENDU'
    ) {
      resetToCompteSuspendu(donnees.suspenduJusqua ?? null);
    }
    return Promise.reject(error);
  },
);

// Aucun fournisseur SMS branche (Twilio retire du projet) -- le backend
// renvoie le code directement dans la reponse, affiche/pre-rempli par l'app
// au lieu d'etre livre par un vrai SMS.
export async function requestOtp(phone: string): Promise<{ code: string }> {
  const res = await apiClient.post<{ code: string }>('/auth/otp/request', {
    phone,
  });
  return res.data;
}

export interface VerifyOtpResponse {
  accessToken: string;
  user: {
    id: string;
    telephone: string;
    role: string;
    nom: string | null;
    // Non nul = la connexion reussit quand meme, mais l'app doit ouvrir
    // l'ecran "compte suspendu" au lieu de l'accueil.
    suspenduJusqua: string | null;
  };
}

export async function verifyOtp(
  phone: string,
  code: string,
): Promise<VerifyOtpResponse> {
  const res = await apiClient.post<VerifyOtpResponse>('/auth/otp/verify', {
    phone,
    code,
  });
  return res.data;
}

export interface Profile {
  id: string;
  nom: string | null;
  prenom: string | null;
  telephone: string;
  // 'etudiant' | 'les deux' (etudiant + conducteur valide) | 'chauffeur'
  // (conducteur valide sans etre etudiant, pas d'universite de rattachement)
  // | 'admin'.
  role: string;
  note: number | null;
  nombreNotations: number;
  universiteId: string | null;
  universite: { id: string; nom: string } | null;
  conducteurStatut: string | null;
  suspenduJusqua: string | null;
}

export async function getProfile(): Promise<Profile> {
  const res = await apiClient.get<Profile>('/users/me');
  return res.data;
}

export async function updateNom(nom: string): Promise<void> {
  await apiClient.patch('/users/me', { nom });
}

// Declaration "je suis chauffeur, pas etudiant" a l'onboarding -- ce compte
// ne sera plus jamais rattache a une universite (voir ChoisirUniversiteScreen).
export async function declarerChauffeur(): Promise<void> {
  await apiClient.patch('/users/me', { estChauffeur: true });
}

export async function updateUniversite(universiteId: string): Promise<void> {
  await apiClient.patch('/users/me', { universiteId });
}

export async function submitConducteurRequest(
  selfieUri: string,
  permisUri: string,
  matriculeVehicule: string,
): Promise<void> {
  const formData = new FormData();
  formData.append('selfie', {
    uri: selfieUri,
    name: 'selfie.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);
  formData.append('permis', {
    uri: permisUri,
    name: 'permis.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);
  formData.append('matriculeVehicule', matriculeVehicule);

  // Ne jamais forcer Content-Type ici : axios/React Native genere la
  // boundary multipart automatiquement a partir du FormData.
  await apiClient.post('/users/me/conducteur', formData);
}

export interface Universite {
  id: string;
  nom: string;
  commune: string;
  latitude: number;
  longitude: number;
}

export async function listUniversites(): Promise<Universite[]> {
  const res = await apiClient.get<Universite[]>('/referentiel/universites');
  return res.data;
}

export interface Commune {
  id: string;
  nom: string;
  ville: string;
}

export async function listCommunes(): Promise<Commune[]> {
  const res = await apiClient.get<Commune[]>('/referentiel/communes');
  return res.data;
}

export interface Quartier {
  id: string;
  nom: string;
  communeId: string;
  commune: Commune;
}

export async function listQuartiers(communeId?: string): Promise<Quartier[]> {
  const res = await apiClient.get<Quartier[]>('/referentiel/quartiers', {
    params: communeId ? { communeId } : undefined,
  });
  return res.data;
}

export interface PointInteret {
  id: string;
  nom: string;
  type: string;
  quartierId: string;
  quartier: Quartier;
  latitude: number;
  longitude: number;
}

export async function listPointsInteret(
  quartierId?: string,
): Promise<PointInteret[]> {
  const res = await apiClient.get<PointInteret[]>('/referentiel/points-interet', {
    params: quartierId ? { quartierId } : undefined,
  });
  return res.data;
}

export interface Trajet {
  id: string;
  heure: string;
  places: number;
  // Montant fixe du par CHAQUE passager (§6) -- ne varie plus selon le nombre
  // de reservants, contrairement a l'ancien prixTotal qui etait redivise.
  cotisation: number;
  pointDeRdv: PointInteret;
  universite: Universite;
  conducteur: {
    id: string;
    nom: string | null;
    prenom: string | null;
    note: number | null;
    nombreNotations: number;
    verifie: boolean;
  };
  dejaReserve: boolean;
  distanceKm?: number;
}

export async function listTrajets(
  universiteId: string,
  communeId: string,
  lat?: number,
  lng?: number,
): Promise<Trajet[]> {
  const res = await apiClient.get<Trajet[]>('/trajets', {
    params: {
      universiteId,
      communeId,
      ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}),
    },
  });
  return res.data;
}

export interface TrajetDetail {
  id: string;
  heure: string;
  places: number;
  cotisation: number;
  statut: string;
  pointDeRdv: PointInteret;
  universite: Universite;
  conducteur: {
    id: string;
    nom: string | null;
    prenom: string | null;
    note: number | null;
    nombreNotations: number;
    verifie: boolean;
  };
  placesDisponibles: number;
  dejaReserve: boolean;
}

export async function getTrajetDetail(trajetId: string): Promise<TrajetDetail> {
  const res = await apiClient.get<TrajetDetail>(`/trajets/${trajetId}`);
  return res.data;
}

export interface CreateTrajetInput {
  universiteId: string;
  pointDeRdvId: string;
  heure: string;
  places: number;
  cotisation: number;
}

export async function publierTrajet(input: CreateTrajetInput): Promise<void> {
  await apiClient.post('/trajets', input);
}

export interface MesTrajetsConducteurTrajet extends TrajetDetail {
  passagers: { id: string; nom: string | null; prenom: string | null }[];
}

export async function listerMesTrajetsConducteur(): Promise<
  MesTrajetsConducteurTrajet[]
> {
  const res = await apiClient.get<MesTrajetsConducteurTrajet[]>(
    '/trajets/mine',
  );
  return res.data;
}

export async function demarrerTrajet(trajetId: string): Promise<void> {
  await apiClient.patch(`/trajets/${trajetId}/demarrer`);
}

export async function terminerTrajet(trajetId: string): Promise<void> {
  await apiClient.patch(`/trajets/${trajetId}/terminer`);
}

export async function annulerTrajet(trajetId: string): Promise<void> {
  await apiClient.patch(`/trajets/${trajetId}/annuler`);
}

export async function signalerPassagerAbsent(
  trajetId: string,
  passagerId: string,
): Promise<void> {
  await apiClient.patch(
    `/trajets/${trajetId}/passagers/${passagerId}/signaler-absence`,
  );
}

export interface Message {
  id: string;
  trajetId: string;
  expediteurId: string;
  contenu: string;
  createdAt: string;
  expediteur: { id: string; nom: string | null; prenom: string | null };
}

export async function listerMessages(trajetId: string): Promise<Message[]> {
  const res = await apiClient.get<Message[]>(`/trajets/${trajetId}/messages`);
  return res.data;
}

export async function envoyerMessage(
  trajetId: string,
  contenu: string,
): Promise<Message> {
  const res = await apiClient.post<Message>(`/trajets/${trajetId}/messages`, {
    contenu,
  });
  return res.data;
}

export interface Notation {
  id: string;
  trajetId: string;
  noteurId: string;
  destinataireId: string;
  etoiles: number;
  commentaire: string | null;
}

export async function listerNotationsTrajet(
  trajetId: string,
): Promise<Notation[]> {
  const res = await apiClient.get<Notation[]>(
    `/trajets/${trajetId}/notations`,
  );
  return res.data;
}

export async function noterParticipant(
  trajetId: string,
  destinataireId: string,
  etoiles: number,
  commentaire?: string,
): Promise<void> {
  await apiClient.post(`/trajets/${trajetId}/notations`, {
    destinataireId,
    etoiles,
    ...(commentaire ? { commentaire } : {}),
  });
}

export interface Avis {
  id: string;
  etoiles: number;
  commentaire: string | null;
  createdAt: string;
  noteur: { nom: string | null; prenom: string | null };
}

export interface AvisUtilisateur {
  note: number | null;
  nombreNotations: number;
  avis: Avis[];
}

export async function listerAvisUtilisateur(
  userId: string,
): Promise<AvisUtilisateur> {
  const res = await apiClient.get<AvisUtilisateur>(
    `/users/${userId}/notations`,
  );
  return res.data;
}

export interface NotationEnAttente {
  trajetId: string;
  cibles: { id: string; label: string }[];
}

export async function listerNotationsEnAttente(): Promise<
  NotationEnAttente[]
> {
  const res = await apiClient.get<NotationEnAttente[]>('/notations/en-attente');
  return res.data;
}

export interface CreateDemandeInput {
  universiteId: string;
  communeId: string;
  heure: string;
  placesRecherchees: number;
  cotisation: number;
  chezMoi: boolean;
  lat?: number;
  lng?: number;
  poiId?: string;
  quartierId?: string;
}

export async function creerDemande(
  input: CreateDemandeInput,
): Promise<{ id: string }> {
  const res = await apiClient.post<{ id: string }>('/demandes', input);
  return res.data;
}

export interface Demande {
  id: string;
  heure: string;
  placesRecherchees: number;
  placesRestantes: number;
  cotisation: number;
  statut: string;
  dejaRejoint: boolean;
  createur: {
    id: string;
    nom: string | null;
    prenom: string | null;
    note: number | null;
    nombreNotations: number;
  };
}

export async function listerDemandes(
  universiteId: string,
  communeId: string,
): Promise<Demande[]> {
  const res = await apiClient.get<Demande[]>('/demandes', {
    params: { universiteId, communeId },
  });
  return res.data;
}

export async function rejoindreDemande(
  demandeId: string,
  lat: number,
  lng: number,
): Promise<void> {
  await apiClient.post(`/demandes/${demandeId}/participations`, { lat, lng });
}

export interface DemandeDisponible extends Demande {
  poi: PointInteret;
  universite: Universite;
}

// universiteId optionnel : un conducteur "chauffeur" (pas d'universite de
// rattachement, voir Profile.role) parcourt alors toutes les demandes de la
// commune, quelle que soit l'universite visee.
export async function listerDemandesDisponibles(
  communeId: string,
  universiteId?: string,
): Promise<DemandeDisponible[]> {
  const res = await apiClient.get<DemandeDisponible[]>('/demandes/disponibles', {
    params: { universiteId, communeId },
  });
  return res.data;
}

export async function accepterDemande(demandeId: string): Promise<void> {
  await apiClient.post(`/demandes/${demandeId}/accepter`);
}

export interface DemandeDetail {
  id: string;
  trajetId: string | null;
  heure: string;
  placesRecherchees: number;
  placesConfirmees: number;
  cotisation: number;
  statut: string;
  universite: Universite;
  commune: Commune;
  poi: PointInteret | null;
  createur: {
    id: string;
    nom: string | null;
    prenom: string | null;
    note: number | null;
    nombreNotations: number;
  };
  conducteur: {
    nom: string | null;
    prenom: string | null;
    note: number | null;
    nombreNotations: number;
    matriculeVehicule: string | null;
  } | null;
  estParticipant: boolean;
}

export async function getDemandeDetail(demandeId: string): Promise<DemandeDetail> {
  const res = await apiClient.get<DemandeDetail>(`/demandes/${demandeId}`);
  return res.data;
}

export interface AnnulationDemandeResultat {
  // Date ISO de fin de suspension quand l'annulation a casse un groupe et
  // qu'il s'agissait de la 2e annulation tardive du createur ; null sinon.
  suspenduJusqua: string | null;
}

export async function annulerDemande(
  demandeId: string,
): Promise<AnnulationDemandeResultat> {
  const res = await apiClient.post<AnnulationDemandeResultat>(
    `/demandes/${demandeId}/annuler`,
  );
  return res.data;
}

// Reserve a un participant (pas le createur) qui veut se retirer d'une
// demande qu'il a rejointe, tant qu'aucun conducteur ne l'a encore acceptee.
export async function quitterDemande(demandeId: string): Promise<void> {
  await apiClient.post(`/demandes/${demandeId}/quitter`);
}

export interface MesDemandesDemande {
  id: string;
  createurId: string;
  trajetId: string | null;
  heure: string;
  placesRecherchees: number;
  placesConfirmees: number;
  cotisation: number;
  statut: string;
  universite: Universite;
  commune: Commune;
  poi: PointInteret | null;
}

export async function listerMesDemandes(): Promise<MesDemandesDemande[]> {
  const res = await apiClient.get<MesDemandesDemande[]>('/demandes/mine');
  return res.data;
}

export async function reserverTrajet(trajetId: string): Promise<void> {
  await apiClient.post(`/trajets/${trajetId}/reservations`);
}

export interface MesReservationsTrajet extends TrajetDetail {
  peutVoirRencontre: boolean;
}

export async function listerMesReservations(): Promise<
  MesReservationsTrajet[]
> {
  const res = await apiClient.get<MesReservationsTrajet[]>(
    '/trajets/mes-reservations',
  );
  return res.data;
}

export interface AnnulationReservationResultat {
  // true quand l'annulation etait tardive : le trajet entier a ete annule,
  // pas seulement la place de ce passager.
  trajetAnnule: boolean;
  // Date ISO de fin de suspension quand cette annulation tardive a declenche
  // la sanction (2e occurrence), null sinon. Renvoye ici pour que l'app
  // puisse expliquer avant de deconnecter, au lieu de subir un 401 muet.
  suspenduJusqua: string | null;
}

// Notifications push : le token identifie l'APPAREIL. Il est enregistre
// apres connexion et supprime a la deconnexion (voir utils/push.ts).
export async function enregistrerAppareilPush(
  token: string,
  plateforme: 'android' | 'ios',
): Promise<void> {
  await apiClient.post('/notifications/appareils', { token, plateforme });
}

export async function supprimerAppareilPush(token: string): Promise<void> {
  await apiClient.delete('/notifications/appareils', { data: { token } });
}

export async function annulerReservation(
  trajetId: string,
): Promise<AnnulationReservationResultat> {
  const res = await apiClient.patch<AnnulationReservationResultat>(
    `/trajets/${trajetId}/reservations/annuler`,
  );
  return res.data;
}

export async function signalerNoShow(trajetId: string): Promise<void> {
  await apiClient.patch(`/trajets/${trajetId}/signaler-absence`);
}

export interface RencontreConducteur {
  nom: string | null;
  prenom: string | null;
  note: number | null;
  nombreNotations: number;
  verifie: boolean;
  matriculeVehicule: string | null;
  photoVehicule: string | null;
  motBienvenue: string | null;
}

export async function getRencontre(
  trajetId: string,
): Promise<{ conducteur: RencontreConducteur }> {
  const res = await apiClient.get<{ conducteur: RencontreConducteur }>(
    `/trajets/${trajetId}/rencontre`,
  );
  return res.data;
}

export function getRencontrePhotoUrl(trajetId: string): string {
  return `${baseURL}/trajets/${trajetId}/rencontre/photo`;
}

// La photo est servie par une route protegee (JwtAuthGuard) -- <Image> RN ne
// passe pas par l'intercepteur axios, le token doit etre injecte via son prop
// `source.headers` (supporte pour les images reseau, voir doc RN Image).
export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync('accessToken');
}

// --- Support (service client) -------------------------------------------
// Ces deux routes restent joignables meme quand le compte est suspendu
// (@AutoriseSiSuspendu cote backend) : c'est l'unique voie de recours contre
// une sanction automatique.

export interface MessageSupport {
  id: string;
  contenu: string;
  statut: string;
  reponse: string | null;
  createdAt: string;
  repondueLe: string | null;
}

export async function envoyerMessageSupport(
  contenu: string,
): Promise<MessageSupport> {
  const res = await apiClient.post<MessageSupport>('/support', { contenu });
  return res.data;
}

export async function listerMesMessagesSupport(): Promise<MessageSupport[]> {
  const res = await apiClient.get<MessageSupport[]>('/support/mes-messages');
  return res.data;
}
