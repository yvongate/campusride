export type MainTabsParamList = {
  Accueil: undefined;
  MesTrajetsPassager: undefined;
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
  TrajetDetail: { trajetId: string };
  Rencontre: { trajetId: string };
  PublierTrajet: undefined;
  MesTrajetsConducteur: undefined;
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
