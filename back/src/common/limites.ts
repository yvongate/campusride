// Bornes metier partagees par les DTO de creation (trajet et demande).
// Centralisees ici pour que les deux modes restent coherents : un trajet et
// une demande decrivent la meme realite (une voiture, des places, un montant
// par personne), il serait absurde qu'ils acceptent des plages differentes.

// 4 passagers maximum, chauffeur non compris -- capacite d'une berline
// ordinaire. Le mobile applique deja cette limite dans ses selecteurs ; sans
// borne cote API, un appel direct pouvait creer une demande a 100 places dont
// le quota n'aurait jamais pu etre atteint (demande zombie jusqu'a
// expiration) ou un trajet impossible a remplir.
export const PLACES_MAX = 4;

// Plafond volontairement large par rapport a un trajet urbain reel a Abidjan
// (quelques centaines a quelques milliers de FCFA) : il ne sert pas a
// encadrer le prix, seulement a rejeter les valeurs manifestement erronees
// ou malveillantes.
export const COTISATION_MAX = 50000;
