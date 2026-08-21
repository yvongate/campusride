import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface LoginAdminResult {
  accessToken: string;
  user: { id: string; email: string; role: string };
}

export async function loginAdmin(
  email: string,
  password: string,
): Promise<LoginAdminResult> {
  const res = await apiClient.post<LoginAdminResult>('/auth/admin/login', {
    email,
    password,
  });
  return res.data;
}

export interface Universite {
  id: string;
  nom: string;
  commune: string;
  latitude: number;
  longitude: number;
}

export type UniversiteInput = Omit<Universite, 'id'>;

export async function listUniversites(): Promise<Universite[]> {
  const res = await apiClient.get<Universite[]>('/referentiel/universites');
  return res.data;
}

export async function createUniversite(
  data: UniversiteInput,
): Promise<Universite> {
  const res = await apiClient.post<Universite>('/referentiel/universites', data);
  return res.data;
}

export async function updateUniversite(
  id: string,
  data: Partial<UniversiteInput>,
): Promise<Universite> {
  const res = await apiClient.patch<Universite>(
    `/referentiel/universites/${id}`,
    data,
  );
  return res.data;
}

export interface Commune {
  id: string;
  nom: string;
  ville: string;
}

export type CommuneInput = Omit<Commune, 'id'>;

export async function listCommunes(): Promise<Commune[]> {
  const res = await apiClient.get<Commune[]>('/referentiel/communes');
  return res.data;
}

export async function createCommune(data: CommuneInput): Promise<Commune> {
  const res = await apiClient.post<Commune>('/referentiel/communes', data);
  return res.data;
}

export interface Quartier {
  id: string;
  nom: string;
  communeId: string;
  commune: Commune;
}

export type QuartierInput = { nom: string; communeId: string };

export async function listQuartiers(communeId?: string): Promise<Quartier[]> {
  const res = await apiClient.get<Quartier[]>('/referentiel/quartiers', {
    params: communeId ? { communeId } : undefined,
  });
  return res.data;
}

export async function createQuartier(data: QuartierInput): Promise<Quartier> {
  const res = await apiClient.post<Quartier>('/referentiel/quartiers', data);
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

export type PointInteretInput = {
  nom: string;
  type: string;
  quartierId: string;
  latitude: number;
  longitude: number;
};

export async function listPointsInteret(
  quartierId?: string,
): Promise<PointInteret[]> {
  const res = await apiClient.get<PointInteret[]>('/referentiel/points-interet', {
    params: quartierId ? { quartierId } : undefined,
  });
  return res.data;
}

export async function createPointInteret(
  data: PointInteretInput,
): Promise<PointInteret> {
  const res = await apiClient.post<PointInteret>(
    '/referentiel/points-interet',
    data,
  );
  return res.data;
}

export interface Statistiques {
  trajetsAujourdhui: number;
  demandesEnAttente: number;
  conducteursAValider: number;
  signalementsOuverts: number;
}

export async function getStatistiques(): Promise<Statistiques> {
  const res = await apiClient.get<Statistiques>('/admin/statistiques');
  return res.data;
}

export interface DemandeConducteur {
  id: string;
  nom: string | null;
  prenom: string | null;
  telephone: string | null;
  matriculeVehicule: string;
  statut: string;
  createdAt: string;
}

export async function listDemandesConducteur(): Promise<DemandeConducteur[]> {
  const res = await apiClient.get<DemandeConducteur[]>(
    '/users/conducteurs/demandes',
  );
  return res.data;
}

export async function validerDemandeConducteur(id: string): Promise<void> {
  await apiClient.patch(`/users/conducteurs/demandes/${id}/valider`);
}

export async function refuserDemandeConducteur(id: string): Promise<void> {
  await apiClient.patch(`/users/conducteurs/demandes/${id}/refuser`);
}

// La route est proteges (JwtAuthGuard) -- un <img src> ou <a href> direct
// n'envoie pas le Bearer token, il faut recuperer le blob via axios (qui
// passe par l'intercepteur) puis en faire une object URL. L'appelant doit
// revoquer l'URL (URL.revokeObjectURL) quand elle n'est plus affichee.
export async function getDocumentConducteurBlobUrl(
  demandeId: string,
  type: 'selfie' | 'permis',
): Promise<string> {
  const res = await apiClient.get(
    `/users/conducteurs/demandes/${demandeId}/documents/${type}`,
    { responseType: 'blob' },
  );
  return URL.createObjectURL(res.data as Blob);
}

export interface Signalement {
  id: string;
  type: string;
  statut: string;
  createdAt: string;
  concerne: { id: string; nom: string | null; prenom: string | null };
  signalePar: { id: string; nom: string | null; prenom: string | null };
  trajet: { id: string; heure: string };
}

export async function listSignalements(): Promise<Signalement[]> {
  const res = await apiClient.get<Signalement[]>('/admin/signalements');
  return res.data;
}

export async function traiterSignalement(id: string): Promise<void> {
  await apiClient.patch(`/admin/signalements/${id}/traiter`);
}

export interface Compte {
  id: string;
  nom: string | null;
  prenom: string | null;
  telephone: string | null;
  role: string;
  note: number | null;
  actif: boolean;
}

export interface PageComptes {
  items: Compte[];
  total: number;
  page: number;
  limit: number;
}

// Pagine cote serveur : le jeu de demonstration couvre toutes les universites
// et depasse les 12 000 comptes, impossible a charger d'un bloc.
export async function listComptes(params: {
  page: number;
  limit: number;
  recherche?: string;
}): Promise<PageComptes> {
  const res = await apiClient.get<PageComptes>('/admin/utilisateurs', {
    params: {
      page: params.page,
      limit: params.limit,
      ...(params.recherche ? { recherche: params.recherche } : {}),
    },
  });
  return res.data;
}

export async function desactiverCompte(id: string): Promise<void> {
  await apiClient.patch(`/admin/utilisateurs/${id}/desactiver`);
}

export async function reactiverCompte(id: string): Promise<void> {
  await apiClient.patch(`/admin/utilisateurs/${id}/reactiver`);
}

export interface MessageSupport {
  id: string;
  contenu: string;
  statut: string;
  reponse: string | null;
  createdAt: string;
  repondueLe: string | null;
  utilisateur: {
    id: string;
    nom: string | null;
    prenom: string | null;
    telephone: string | null;
    // Permet de lever la suspension directement depuis la reponse : la
    // plupart des messages viennent justement de comptes sanctionnes.
    suspenduJusqua: string | null;
    actif: boolean;
  };
}

export async function listMessagesSupport(): Promise<MessageSupport[]> {
  const res = await apiClient.get<MessageSupport[]>('/admin/support');
  return res.data;
}

export async function repondreMessageSupport(
  id: string,
  reponse: string,
): Promise<void> {
  await apiClient.patch(`/admin/support/${id}/repondre`, { reponse });
}
