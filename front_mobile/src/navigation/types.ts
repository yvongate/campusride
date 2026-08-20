export type MainTabsParamList = {
  Accueil: undefined;
  MesTrajetsPassager: { tab?: 'encours' | 'historique' } | undefined;
  MessagesHub: undefined;
  Profil: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Localisation: undefined;
  Connexion: undefined;
  VerificationOtp: { phone: string; code: string };
  MainTabs: undefined;
  InscriptionConducteur: undefined;
  CompleterProfil: undefined;
  ChoisirUniversite: undefined;
  TrajetDetail: { trajetId: string };
  Rencontre: { trajetId: string };
  PublierTrajet: undefined;
  MesTrajetsConducteur: { tab?: 'avenir' | 'termines' } | undefined;
  MesInformations: undefined;
  Parametres: undefined;
  Aide: undefined;
  Support: undefined;
  CompteSuspendu: { suspenduJusqua: string | null };
  Avis: { userId: string; nom: string };
  Messagerie: { trajetId: string };
  Notation: {
    trajetId: string;
    cibles: { id: string; label: string }[];
  };
  CreerDemande: { universiteId?: string; communeId?: string } | undefined;
  DemandesDisponibles: undefined;
  PointDeRegroupement: { demandeId: string };
  SignalerAbsence: {
    trajetId: string;
    passagers: { id: string; nom: string | null; prenom: string | null }[];
  };
};
