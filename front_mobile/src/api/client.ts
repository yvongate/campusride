import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

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
  user: { id: string; telephone: string; role: string };
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
  note: number | null;
  conducteurStatut: string | null;
  verificationStatut: string | null;
}

export async function getProfile(): Promise<Profile> {
  const res = await apiClient.get<Profile>('/users/me');
  return res.data;
}

// Le selfie n'est plus demande ici -- il vient de la verification d'identite
// generale (CNI + selfie), deja validee avant d'atteindre cet ecran (voir
// submitVerificationIdentite ci-dessous).
export async function submitConducteurRequest(
  permisUri: string,
  matriculeVehicule: string,
): Promise<void> {
  const formData = new FormData();
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

export async function submitVerificationIdentite(
  cniUri: string,
  selfieUri: string,
): Promise<void> {
  const formData = new FormData();
  formData.append('cni', {
    uri: cniUri,
    name: 'cni.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);
  formData.append('selfie', {
    uri: selfieUri,
    name: 'selfie.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  await apiClient.post('/users/me/verification', formData);
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
  prixTotal: number;
  pointDeRdv: PointInteret;
  universite: Universite;
  conducteur: {
    id: string;
    nom: string | null;
    prenom: string | null;
    note: number | null;
    verifie: boolean;
  };
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
  prixTotal: number;
  statut: string;
  pointDeRdv: PointInteret;
  universite: Universite;
  conducteur: {
    id: string;
    nom: string | null;
    prenom: string | null;
    note: number | null;
    verifie: boolean;
  };
  placesDisponibles: number;
  prixParPersonnePreview: number;
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
  prixTotal: number;
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
}

export async function listerDemandesDisponibles(
  universiteId: string,
  communeId: string,
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
  };
  conducteur: {
    nom: string | null;
    prenom: string | null;
    note: number | null;
    matriculeVehicule: string | null;
  } | null;
  estParticipant: boolean;
}

export async function getDemandeDetail(demandeId: string): Promise<DemandeDetail> {
  const res = await apiClient.get<DemandeDetail>(`/demandes/${demandeId}`);
  return res.data;
}

export async function annulerDemande(demandeId: string): Promise<void> {
  await apiClient.post(`/demandes/${demandeId}/annuler`);
}

export interface MesDemandesDemande {
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

export async function annulerReservation(trajetId: string): Promise<void> {
  await apiClient.patch(`/trajets/${trajetId}/reservations/annuler`);
}

export async function signalerNoShow(trajetId: string): Promise<void> {
  await apiClient.patch(`/trajets/${trajetId}/signaler-absence`);
}

export interface RencontreConducteur {
  nom: string | null;
  prenom: string | null;
  note: number | null;
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
