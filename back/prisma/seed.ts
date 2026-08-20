// Seed de demonstration (soutenance) : peuple le referentiel (universites,
// communes, quartiers, points d'interet) et garantit un compte admin
// utilisable, sans dependre d'un flux OTP ou d'une creation manuelle.
// Idempotent : peut etre relance sans dupliquer les donnees (recherche par
// nom avant creation ; upsert par email pour l'admin).
import 'dotenv/config';
import bcryptjs from 'bcryptjs';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const ADMIN_EMAIL = 'admin@campusride.ci';
const ADMIN_PASSWORD = 'CampusRide2026!';

// Coordonnees des 6 grandes universites publiques/reconnues, verifiees une a
// une sur OpenStreetMap (Nominatim) le 2026-08-15 -- les valeurs precedentes
// etaient de simples approximations, avec des ecarts allant jusqu'a 5 km
// (INP-HB) par rapport a la position reelle. Important car ces coordonnees
// alimentent desormais l'appariement par proximite (voir plus bas), pas
// seulement l'affichage. Memes noms que UI_inspo/CampusRide App.dc.html pour
// les 5 premieres (demo/soutenance) -- UVCI ajoutee a la demande de Yvon.
const UNIVERSITES = [
  { nom: 'FHB Cocody', commune: 'Cocody', latitude: 5.3427422, longitude: -3.9871308 },
  { nom: 'INP-HB', commune: 'Yamoussoukro', latitude: 6.8732178, longitude: -5.2353884 },
  {
    nom: 'Université Nangui Abrogoua',
    commune: 'Abobo',
    latitude: 5.3885482,
    longitude: -4.0160478,
  },
  { nom: 'ESATIC', commune: 'Treichville', latitude: 5.2906335, longitude: -3.9987569 },
  {
    nom: "Université Catholique de l'Afrique de l'Ouest (UCAO)",
    commune: 'Cocody',
    latitude: 5.3312492,
    longitude: -3.9957166,
  },
  {
    nom: "Université Virtuelle de Côte d'Ivoire (UVCI)",
    commune: 'Cocody',
    latitude: 5.3553621,
    longitude: -4.0053499,
  },
];

// Etablissements prives (instituts/ecoles superieures), importes depuis un
// export CSV/Excel fourni par Yvon (uni.txt, 611 lignes brutes, filtre a 429
// pour la seule ville d'Abidjan -- les autres villes n'ont pas de communes
// seedees dans COMMUNES_DATA plus bas, donc aucun trajet n'y serait jamais
// possible). Aucun de ces etablissements n'a ete trouve sur OpenStreetMap
// (verifie sur un echantillon de 30 : 0/30) -- ce sont pour la plupart de
// petites structures privees non cartographiees. Faute de position exacte,
// chacun recoit une position aleatoire (seed fixe 20260815, reproductible)
// dans un rayon de 1.3 km autour du centre reel de sa commune (elle, connue
// avec certitude depuis le fichier source) -- categoriquement different
// d'une position aleatoire dans Abidjan entier, qui aurait fausse
// l'appariement par proximite. 4 lignes exclues (commune vide, ou communes
// "BONOUA"/"DUEKOUE" -- des villes hors Abidjan, incoherentes avec la ville
// "ABIDJAN" indiquee sur ces memes lignes, erreur de saisie manifeste dans
// le fichier source).
const UNIVERSITES_PRIVEES = [
  { nom: 'ABIDJAN BLOOM UNIVERSITY (ABU)', commune: 'Cocody', latitude: 5.357407, longitude: -3.998416 },
  { nom: 'ABIDJAN BUSINESS SCHOOL -(ABS)', commune: 'Cocody', latitude: 5.349526, longitude: -3.991717 },
  { nom: 'ACADEMIE DE GESTION ET D\'HOTELLERIE -(AGH)', commune: 'Cocody', latitude: 5.346352, longitude: -3.993914 },
  { nom: 'ACADEMIE DE L\'ENTREPRENEURIAT ET DES METIERS (AEM) YOPOUGON', commune: 'Yopougon', latitude: 5.328625, longitude: -4.083418 },
  { nom: 'ACADEMIE DES SCIENCES TECHNOLOGIQUES ET COMPTABLES -(ASTC PLATEAU)', commune: 'Plateau', latitude: 5.333471, longitude: -4.028067 },
  { nom: 'ACADEMIE DES SCIENCES TECHNOLOGIQUES ET COMPTABLES COCODY -(ASTC COCODY)', commune: 'Cocody', latitude: 5.351522, longitude: -4.00476 },
  { nom: 'ACADEMIE ELITES', commune: 'Yopougon', latitude: 5.341998, longitude: -4.085125 },
  { nom: 'ACADEMIE FICOGES COCODY', commune: 'Cocody', latitude: 5.354554, longitude: -3.995171 },
  { nom: 'ACADEMIE INTERNATIONALE DES SCIENCES ET TECHNIQUES PLATEAU -(AIST PLATEAU)', commune: 'Plateau', latitude: 5.331408, longitude: -4.022909 },
  { nom: 'ACADEMIE INTERNATIONALE DES SCIENCES ET TECHNIQUES RIVIERA BONOUMIN -(AIST RIVIERA BONOUMIN)', commune: 'Cocody', latitude: 5.364226, longitude: -3.987112 },
  { nom: 'ACADEMIE INTERNATIONALE DES SCIENCES ET TECHNIQUES TREICHVILLE -(AIST TREICHVILLE)', commune: 'Treichville', latitude: 5.305019, longitude: -4.006499 },
  { nom: 'ACADEMIE LIBRE DE TECHNOLOGIE-INSTITUT SECONDAIRE DE TECHNOLOGIE -(ALT-ISTEA YOPOUGON)', commune: 'Yopougon', latitude: 5.327071, longitude: -4.078542 },
  { nom: 'AFRICAN VISION INSTITUT DE DEVELOPPEMENT ET D\'ECONOMIE -(AVIDE EDUCATION)', commune: 'Cocody', latitude: 5.35245, longitude: -3.998487 },
  { nom: 'AFRIQUE FORMATION -(AF)', commune: 'Koumassi', latitude: 5.28784, longitude: -3.948339 },
  { nom: 'ALT - ISTEA', commune: 'Yopougon', latitude: 5.337199, longitude: -4.082748 },
  { nom: 'ATLANTIQUE INTERNATIONAL BUSINESS SCHOOL -(AIBS)', commune: 'Cocody', latitude: 5.35192, longitude: -4.003064 },
  { nom: 'ATSAM-AGI', commune: 'Yopougon', latitude: 5.326827, longitude: -4.073035 },
  { nom: 'BA’OULEHN INSTITUTE OF TECHNOLOGIE (BIT )', commune: 'Cocody', latitude: 5.346016, longitude: -3.995334 },
  { nom: 'BRITISH INTERNATIONALUNIVERSITY (BIU)', commune: 'Cocody', latitude: 5.349006, longitude: -3.991682 },
  { nom: 'CELIA TREICHVILLE/EP2005', commune: 'Treichville', latitude: 5.315568, longitude: -4.00535 },
  { nom: 'CENTRALE SUP -(CS)', commune: 'Cocody', latitude: 5.351333, longitude: -4.00039 },
  { nom: 'CENTRE D ENSEIGNEMENT SUPERIEUR ET DES TECHNOLOGIES INTERNATIONALES D\'ABIDJAN -(CESTIA-2EP)', commune: 'Cocody', latitude: 5.357663, longitude: -3.984163 },
  { nom: 'CENTRE D\'ENSEIGNEMENT TECHNIQUE PROFESSIONNEL DES METIERS ET DE L\'ENERGIE RENOUVELABLES (CETPMER)', commune: 'Adjamé', latitude: 5.347939, longitude: -4.021659 },
  { nom: 'CENTRE D\'ETUDES, DE FORMATION EN INFORMATIQUE ET VISIO ENSEIGNEMENT -(CEFIVE)', commune: 'Cocody', latitude: 5.350326, longitude: -3.991871 },
  { nom: 'CENTRE DE FORMATION A LA GESTION DES ENTREPRISES DE CÔTE D\'IVOIRE (CFGE)', commune: 'Cocody', latitude: 5.365437, longitude: -3.999006 },
  { nom: 'CENTRE DE FORMATION EN ADMINISTRATION ET EN MECANIQUE -(CFAM)', commune: 'Cocody', latitude: 5.346217, longitude: -3.997675 },
  { nom: 'CENTRE DES ETUDES SUPERIEURES DES ETUDES D\'ABIDJAN KOUMASSI -(CESA KOUMASSI)', commune: 'Koumassi', latitude: 5.283657, longitude: -3.951228 },
  { nom: 'CENTRE DES ETUDES SUPERIEURES DES ETUDES D\'ABIDJAN PLATEAU -(CESA PLATEAU)', commune: 'Plateau', latitude: 5.327499, longitude: -4.020282 },
  { nom: 'CENTRE DES ETUDES SUPERIEURES DES ETUDES D\'ABIDJAN YOPOUGON -(CESA YOPOUGON)', commune: 'Yopougon', latitude: 5.339462, longitude: -4.074617 },
  { nom: 'CENTRE INTERNATIONAL DE FORMATION EN PRESENTIELLE ET A DISTANCE COCODY -(CIFAD COCODY)', commune: 'Cocody', latitude: 5.352888, longitude: -4.002731 },
  { nom: 'CENTRE INTERNATIONAL DE FORMATION EN PRESENTIELLE ET A DISTANCE YOPOUGON -(CIFAD YOPOUGON)', commune: 'Yopougon', latitude: 5.325371, longitude: -4.081388 },
  { nom: 'CENTRE INTERNATIONAL DU MANAGEMENT ET DE L\'ENTREPRENEURIAT -(CIME-FORMATION ABIDJAN)', commune: 'Cocody', latitude: 5.358317, longitude: -4.005803 },
  { nom: 'CHANTIERS ECOLE DES METIERS DU BATIMENT ET DES TRAVAUX PUBLICS -(CEM-BTP COCODY)', commune: 'Cocody', latitude: 5.363288, longitude: -4.000761 },
  { nom: 'CIFC ABIDJAN', commune: 'Cocody', latitude: 5.362036, longitude: -3.988708 },
  { nom: 'CIFEC ABIDJAN', commune: 'Plateau', latitude: 5.329001, longitude: -4.013476 },
  { nom: 'COURS SUPERIEUR NOTRE DAME DU PLATEAU -(CSNDP)', commune: 'Plateau', latitude: 5.316879, longitude: -4.023909 },
  { nom: 'COURS SUPERIEUR SAINT PIERRE MARCORY -(CSSP MARCORY)', commune: 'Marcory', latitude: 5.302342, longitude: -3.979205 },
  { nom: 'DEMING EXCELLENCE INSTITUTE GRANDE ÉCOLE (DEI)', commune: 'Cocody', latitude: 5.348397, longitude: -3.987435 },
  { nom: 'ECOEL SUPERIEURE DE MANAGEMENT ET DE TECHNOLOGIE -(EMATECH)', commune: 'Cocody', latitude: 5.352474, longitude: -4.00494 },
  { nom: 'ECOLE CENTRALE D\'ABIDJAN -(ECA)', commune: 'Cocody', latitude: 5.352577, longitude: -3.998879 },
  { nom: 'ECOLE DE COMMERCE ET DE GESTION (ECG)', commune: 'Marcory', latitude: 5.312278, longitude: -3.979528 },
  { nom: 'ECOLE DE FORMATION EN GESTION ET EN TECHNOLOGIE -(EFGT ABIDJAN)', commune: 'Abobo', latitude: 5.422147, longitude: -4.015185 },
  { nom: 'ECOLE DE FORMATION INDUSTRIELLE ET TERTIAIRE -(EFIT-CESTIA)', commune: 'Cocody', latitude: 5.363328, longitude: -3.989868 },
  { nom: 'ECOLE DE GEOMATIQUE ET DU TERRITOIRE (EGT-ABIDJAN)', commune: 'Cocody', latitude: 5.361189, longitude: -4.004598 },
  { nom: 'ECOLE DE GESTION ET DE TECHNOLOGIES -(EGETECH)', commune: 'Cocody', latitude: 5.349376, longitude: -3.994843 },
  { nom: 'ECOLE DES CADRES D\'ABIDJAN MARCORY (EDCA)', commune: 'Marcory', latitude: 5.302091, longitude: -3.992088 },
  { nom: 'ECOLE DES ETUDES COMMERCIALES ET ECONOMIQUES -(EECE YOPOUGON)', commune: 'Yopougon', latitude: 5.337936, longitude: -4.079635 },
  { nom: 'ECOLE DES ETUDES COMMERCIALES ET ECONOMIQUES -(EECE)', commune: 'Cocody', latitude: 5.359254, longitude: -3.996416 },
  { nom: 'ECOLE DES NUMERIQUES, DE L\'ADMINISTRATION ET DE TELECOMMUNICATION ABOBO (ENATEL)', commune: 'Abobo', latitude: 5.436038, longitude: -4.021729 },
  { nom: 'ECOLE DES SCIENCES APPLIQUEES -(ESAP)', commune: 'Yopougon', latitude: 5.33126, longitude: -4.070647 },
  { nom: 'ECOLE DES SPÉCIALITÉS MULTIMÉDIA D\'ABIDJAN MARCORY -(ESMA MARCORY)', commune: 'Marcory', latitude: 5.300306, longitude: -3.980366 },
  { nom: 'ECOLE DES SPÉCIALITÉS MULTIMÉDIA D\'ABIDJAN RIVIERA -(ESMA RIVIÉRA)', commune: 'Cocody', latitude: 5.350685, longitude: -4.001264 },
  { nom: 'ECOLE INTERNATIONALE DES PONTS ET CHAUSSEES D\'ABIDJAN -(EIPC-ABIDJAN)', commune: 'Cocody', latitude: 5.36479, longitude: -3.987707 },
  { nom: 'ECOLE INTERNATIONALE TERTIAIRE DES NOUVELLES TECHNOLOGIES DE L\'INFORMATION ET DE LA COMMUNICATION COCODY -(EIT-NTIC COCODY)', commune: 'Cocody', latitude: 5.352032, longitude: -3.992501 },
  { nom: 'ECOLE POLYFINANCE ET DE TECHNOLOGIE APPLIQUEE -(EPTA)', commune: 'Cocody', latitude: 5.35798, longitude: -3.990442 },
  { nom: 'ECOLE POLYTECHNIQUE D\'ABIDJAN -(EPA)', commune: 'Yopougon', latitude: 5.342772, longitude: -4.080865 },
  { nom: 'ECOLE PRATIQUE DE LA CHAMBRE DE COMMERCE ET D\'INDUSTRIE DE CÔTE D\'IVOIRE -(EPCCI)', commune: 'Plateau', latitude: 5.331476, longitude: -4.02655 },
  { nom: 'ECOLE SPECIALE DU BÂTIMENT ET DES TRAVAUX PUBLICS PLATEAU -(ESBTP PLATEAU)', commune: 'Plateau', latitude: 5.33185, longitude: -4.022704 },
  { nom: 'ECOLE SPECIALE DU BÂTIMENT ET DES TRAVAUX PUBLICS TREICHVILLE -(ESBTP TREICHVILLE)', commune: 'Treichville', latitude: 5.308646, longitude: -4.013922 },
  { nom: 'ECOLE SPECIALE DU BÂTIMENT ET DES TRAVAUX PUBLICS YOPOUGON -(ESBTP YOPOUGON)', commune: 'Yopougon', latitude: 5.336673, longitude: -4.076906 },
  { nom: 'ECOLE SUPERIEUR DE COMMERCE ET DE GESTION LA SORBONNE -(ESCG LA SORBONNE)', commune: 'Yopougon', latitude: 5.3287, longitude: -4.06693 },
  { nom: 'ECOLE SUPERIEUR EN INGENIERIE ET GESTION D\'ABIDJAN (ESIG - ABIDJAN)', commune: 'Abobo', latitude: 5.416529, longitude: -4.020265 },
  { nom: 'ECOLE SUPERIEUR FATOUMABA', commune: 'Yopougon', latitude: 5.334548, longitude: -4.084017 },
  { nom: 'ECOLE SUPERIEUR FATOUMABA -(ESFAT)', commune: 'Yopougon', latitude: 5.338795, longitude: -4.078034 },
  { nom: 'ECOLE SUPERIEUR POLYTECHNIQUE -(ESP)', commune: 'Cocody', latitude: 5.354421, longitude: -4.003699 },
  { nom: 'ECOLE SUPERIEURE WONTO -(ESW)', commune: 'Cocody', latitude: 5.360765, longitude: -4.0055 },
  { nom: 'ECOLE SUPERIEURE AMINA -(ESA)', commune: 'Cocody', latitude: 5.367836, longitude: -3.99334 },
  { nom: 'ECOLE SUPERIEURE D\'ENSEIGNEMENT TECHNIQUE ET PROFESSIONNELLE (ESETP) YOPOUGON', commune: 'Yopougon', latitude: 5.330172, longitude: -4.084876 },
  { nom: 'ECOLE SUPERIEURE D\'EXPERTISE COMPTABLE -(ESEC)', commune: 'Cocody', latitude: 5.364822, longitude: -3.988359 },
  { nom: 'ECOLE SUPERIEURE D\'INFORMATIQUE APPLIQUEE -(ESIA)', commune: 'Cocody', latitude: 5.357624, longitude: -3.994856 },
  { nom: 'ECOLE SUPERIEURE D\'INFORMATIQUE ET DE COMMERCE COCODY -(ESICOM COCODY)', commune: 'Cocody', latitude: 5.360989, longitude: -3.985341 },
  { nom: 'ECOLE SUPERIEURE D\'INFORMATIQUE ET DE L\'INNOVATION PLATEAU -(ES2I PLATEAU)', commune: 'Plateau', latitude: 5.337134, longitude: -4.02343 },
  { nom: 'ECOLE SUPERIEURE D\'INFORMATIQUE ET DE L\'INNOVATION YOPOUGON -(ES2I YOPOUGON)', commune: 'Yopougon', latitude: 5.335889, longitude: -4.069253 },
  { nom: 'ECOLE SUPERIEURE D\'INTELLIGENCE ECONOMIQUE COCODY -(ESIE COCODY)', commune: 'Cocody', latitude: 5.351202, longitude: -4.001893 },
  { nom: 'ECOLE SUPERIEURE D\'INTELLIGENCE ECONOMIQUE YOPOUGON -(ESIE YOPOUGON)', commune: 'Yopougon', latitude: 5.333202, longitude: -4.087047 },
  { nom: 'ECOLE SUPERIEURE DE COMMERCE CASTAING -(ESC CASTAING)', commune: 'Plateau', latitude: 5.333103, longitude: -4.027682 },
  { nom: 'ECOLE SUPERIEURE DE COMMERCE D\'ADMINISTRATION ET DE MANAGEMENT COCODY -(ESCAM COCODY)', commune: 'Cocody', latitude: 5.355889, longitude: -4.003534 },
  { nom: 'ECOLE SUPERIEURE DE COMMERCE ET DE GESTION (ESK) ANNEXE YOPOUGON', commune: 'Yopougon', latitude: 5.334356, longitude: -4.079313 },
  { nom: 'ECOLE SUPERIEURE DE FORMATION AUX METIERS D\'INFORMATIQUE ET DE GESTION -(ESFIG)', commune: 'Cocody', latitude: 5.360649, longitude: -3.99718 },
  { nom: 'ECOLE SUPERIEURE DE GESTION DES SCIENCES ET DE COMMUNICATION (ES-GSC)', commune: 'Cocody', latitude: 5.355281, longitude: -3.987436 },
  { nom: 'ECOLE SUPERIEURE DE L\'ELITE AFRICAINE -(ESEA)', commune: 'Cocody', latitude: 5.367477, longitude: -3.99981 },
  { nom: 'ECOLE SUPERIEURE DE L\'ENSEIGNEMENT TECHNIQUE ET COMMERCIAL COCODY -(ESETEC COCODY)', commune: 'Cocody', latitude: 5.355914, longitude: -3.992311 },
  { nom: 'ECOLE SUPERIEURE DE LA MER -(ESM)', commune: 'Cocody', latitude: 5.358568, longitude: -3.984109 },
  { nom: 'ECOLE SUPERIEURE DE L’ELITE INTERNATIONALE COCODY', commune: 'Cocody', latitude: 5.350385, longitude: -3.998571 },
  { nom: 'ECOLE SUPERIEURE DE MANAGEMENT ET DE COMMUNICATION (ESMC)', commune: 'Bingerville', latitude: 5.360257, longitude: -3.894103 },
  { nom: 'ECOLE SUPERIEURE DE MANAGEMENT ET DE TECHNOLOGIE LE GROUPE BOWL -(ESMAT LE GROUPE BOWL)', commune: 'Yopougon', latitude: 5.345222, longitude: -4.072724 },
  { nom: 'ECOLE SUPERIEURE DE MANAGEMENT ET DES TECHNOLOGIES -(ESUMAT ABIDJAN)', commune: 'Yopougon', latitude: 5.33908, longitude: -4.06933 },
  { nom: 'ECOLE SUPERIEURE DE MARKETING DE L\'INFORMATION ET DE TECHNOLOGIE -(ESMIT)', commune: 'Yopougon', latitude: 5.34458, longitude: -4.08233 },
  { nom: 'ECOLE SUPERIEURE DE TECHNOLOGIE DE COMMERCE ET DE MANAGEMENT ANYAMA -(ESTCOM)', commune: 'Anyama', latitude: 5.485898, longitude: -4.047204 },
  { nom: 'ECOLE SUPERIEURE DES AFFAIRES ET MANAGEMENT YOPOUGON -(ESAM YOPOUGON)', commune: 'Yopougon', latitude: 5.346096, longitude: -4.076361 },
  { nom: 'ECOLE SUPERIEURE DES AFFAIRES ET MANAGEMENT/INSTITUT DES HAUTES ETUDES PROFESSIONNELLES ET TECHNIQUES -(ESAM/IHPT)', commune: 'Plateau', latitude: 5.333757, longitude: -4.018726 },
  { nom: 'ECOLE SUPERIEURE DES AFFAIRES ET MANAGEMENT/INSTITUT POLYTECHNIQUE KOKO N\'GUESSAN -(ESAM/IPKN)', commune: 'Plateau', latitude: 5.326781, longitude: -4.011036 },
  { nom: 'ECOLE SUPERIEURE DES METIERS APPLIQUES DE COTE D\'IVOIRE (ESMACI)', commune: 'Yopougon', latitude: 5.34394, longitude: -4.075397 },
  { nom: 'ECOLE SUPERIEURE DES SCIENCES ECONOMIQUES COMMERCIALES ET DE TECHNOLOGIES POINCARE COCODY -(ESSECT POINCARE COCODY)', commune: 'Cocody', latitude: 5.355674, longitude: -3.983323 },
  { nom: 'ECOLE SUPERIEURE DES TECHNIQUES ET SPECIALITES POUR L\'EDUCATION ET LA FORMATION -(EDUFOR)', commune: 'Yopougon', latitude: 5.334413, longitude: -4.076939 },
  { nom: 'ECOLE SUPERIEURE DES TECHNOLOGIES AVANCEES ET DE MANAGEMENT COCODY (ESTAM COCODY)', commune: 'Cocody', latitude: 5.365671, longitude: -3.994178 },
  { nom: 'ECOLE SUPERIEURE DES TECHNOLOGIES DE L\'INDUSTRIE, DU MANAGEMENT ET DE L\'ENTREPRENEURIAT -(ESTIME)', commune: 'Yopougon', latitude: 5.340099, longitude: -4.068139 },
  { nom: 'ECOLE SUPERIEURE FORMATION AGRICOLE LE PHENIX', commune: 'Cocody', latitude: 5.350395, longitude: -3.995012 },
  { nom: 'ECOLE SUPERIEURE GADJI (ESUG) PORT-BOUET', commune: 'Port-Bouët', latitude: 5.249982, longitude: -3.953625 },
  { nom: 'ECOLE SUPERIEURE GADJI (ESUG) YOPOUGON', commune: 'Yopougon', latitude: 5.336219, longitude: -4.064593 },
  { nom: 'ECOLE SUPERIEURE GADJI -(ESUG)', commune: 'Plateau', latitude: 5.320624, longitude: -4.013863 },
  { nom: 'ECOLE SUPERIEURE INTERNATIONALE DE GESTION ET DE MANAGEMENT (ESIGEM)', commune: 'Plateau', latitude: 5.316489, longitude: -4.021722 },
  { nom: 'ECOLE SUPERIEURE INTERNATIONALE LE ROI SALOMON YOPOUGON', commune: 'Yopougon', latitude: 5.339622, longitude: -4.080723 },
  { nom: 'ECOLE SUPERIEURE INTERNATIONALE POLYTECHNIQUE ADAMA SANOGO -(ESIAS)', commune: 'Abobo', latitude: 5.429396, longitude: -4.022556 },
  { nom: 'ECOLE SUPERIEURE KINDALL -(ESK)', commune: 'Anyama', latitude: 5.500624, longitude: -4.059744 },
  { nom: 'ECOLE SUPERIEURE LA BONNE ESPERANCE -(ESBE)', commune: 'Cocody', latitude: 5.360879, longitude: -3.984952 },
  { nom: 'ECOLE SUPERIEURE LE PETIT CHAMPION -(ESPC)', commune: 'Abobo', latitude: 5.433292, longitude: -4.024197 },
  { nom: 'ECOLE SUPERIEURE POLYTECHNIQUE (ESP)', commune: 'Cocody', latitude: 5.363083, longitude: -3.991088 },
  { nom: 'ECOLE SUPERIEURE POLYTECHNIQUE MINCH (ESPM)', commune: 'Treichville', latitude: 5.306265, longitude: -3.999165 },
  { nom: 'ECOLE SUPERIEURE SAINT JEAN-MARIE VIANNEY -(E2S-JMV)', commune: 'Yopougon', latitude: 5.334289, longitude: -4.082367 },
  { nom: 'ECOLE SUPERIEURE SKT', commune: 'Yopougon', latitude: 5.331971, longitude: -4.083606 },
  { nom: 'ECOLE SUPERIEURE TECHNIQUE ET PROFESSIONNELLE LE JOURDAIN', commune: 'Cocody', latitude: 5.365612, longitude: -3.993765 },
  { nom: 'ECOLE SUPERIEURE YAMOUSSO MACAU (ESYM)', commune: 'Cocody', latitude: 5.362402, longitude: -3.999729 },
  { nom: 'ECOLE SUPERIEURE YOBOUE KOUASSI BLE -(ESYKB)', commune: 'Yopougon', latitude: 5.331696, longitude: -4.077629 },
  { nom: 'ECOLE SUPÉRIEUR DE MARKETING, DE L\'INFORMATION ET DE TECHNOLOGIE', commune: 'Yopougon', latitude: 5.342337, longitude: -4.071433 },
  { nom: 'ECOLE SUPÉRIEURE DE TECHNOLOGIE -(EST-LOKO)', commune: 'Marcory', latitude: 5.308493, longitude: -3.993577 },
  { nom: 'ECOLE SUPÉRIEURE INTERNATIONALE DE GESTION ET MANAGEMENT (ESIGEM YOPOUGON)', commune: 'Yopougon', latitude: 5.344651, longitude: -4.074523 },
  { nom: 'ECOLE SUPÉRIEURE TERTIAIRE ET DE TECHNOLOGIE APPLIQUÉE -(ESTTA) - GROUPE LOKO', commune: 'Plateau', latitude: 5.332138, longitude: -4.03084 },
  { nom: 'ECOLE TECHNIQUE D\'ENSEIGNEMENT PROFESSIONNEL PLATEAU -(ETEP PLATEAU)', commune: 'Plateau', latitude: 5.325796, longitude: -4.021515 },
  { nom: 'ECOLE TECHNIQUE INFORMATIQUE ET COMMERCIALE ABOBO -(ETIC ABOBO)', commune: 'Abobo', latitude: 5.417096, longitude: -4.024919 },
  { nom: 'ECOLE TECHNIQUE INFORMATIQUE ET COMMERCIALE COCODY -(ETIC COCODY)', commune: 'Cocody', latitude: 5.359399, longitude: -3.993747 },
  { nom: 'ECOLE TECHNIQUE INFORMATIQUE ET COMMERCIALE MARCORY -(ETIC MARCORY)', commune: 'Marcory', latitude: 5.301007, longitude: -3.984003 },
  { nom: 'ECOLE TECHNIQUE INFORMATIQUE ET COMMERCIALE YOPOUGON -(ETIC YOPOUGON)', commune: 'Yopougon', latitude: 5.338131, longitude: -4.071494 },
  { nom: 'ECOLE TECHNIQUE SUPERIEURE SAGUIDIBA YOPOUGON -(ESTA YOPOUGON)', commune: 'Yopougon', latitude: 5.338817, longitude: -4.082412 },
  { nom: 'ECOLE WILLIAM PONTY -(EWP) - GROUPE LOKO', commune: 'Yopougon', latitude: 5.342623, longitude: -4.067844 },
  { nom: 'EFAC (ECOLE DE FORMATION D’ASSISTANCE ET DE CONSEIL)', commune: 'Cocody', latitude: 5.367295, longitude: -3.993648 },
  { nom: 'EPHESE-TECHNOLOGIE (ECOLE POLYTECHNIQUE DES HAUTES ETUDES D\'ECONOMIE DE SCIENCES ET DE TECHNOLOGIE)', commune: 'Yopougon', latitude: 5.331423, longitude: -4.068217 },
  { nom: 'EPMACI - Ecole polyvalente du Maghreb en Côte d’Ivoire - RIVIERA', commune: 'Cocody', latitude: 5.357798, longitude: -3.984408 },
  { nom: 'ESAM VRIDI ABIDJAN', commune: 'Port-Bouët', latitude: 5.24767, longitude: -3.956374 },
  { nom: 'ESCA-CI (Ecole Supérieure de Commerce et desAffaires de CI)', commune: 'Cocody', latitude: 5.360727, longitude: -4.004746 },
  { nom: 'ESCAM (ECOLE SUPERIEURE DE COMMERCE, D\'ADMINISTRATION ET DE MANAGEMENT) BINGERVILLE', commune: 'Bingerville', latitude: 5.358787, longitude: -3.88967 },
  { nom: 'ESCAMT (ECOLE SUPERIEURE DE COMMERCE, D\'ADMINISTRATION ET DE MANAGEMENT ET TECHNIQUE) YOPOUGON', commune: 'Yopougon', latitude: 5.329748, longitude: -4.083079 },
  { nom: 'ESCI PLATEAU -(ESCI PLATEAU)', commune: 'Plateau', latitude: 5.322873, longitude: -4.024883 },
  { nom: 'ESCI YOPOUGON -(ESCI YOPOUGON)', commune: 'Yopougon', latitude: 5.339659, longitude: -4.076746 },
  { nom: 'ESDE SUP', commune: 'Yopougon', latitude: 5.330462, longitude: -4.065013 },
  { nom: 'ESEPT Ecole Supérieure d’Enseignement Professionnel et Technique', commune: 'Yopougon', latitude: 5.326772, longitude: -4.081769 },
  { nom: 'ESFIT S.A', commune: 'Cocody', latitude: 5.358929, longitude: -3.992394 },
  { nom: 'ESIGE (ECOLE SUPERIEURE D\'INFORMATIQUE ET DE GESTION D\'ENTREPRISE)', commune: 'Cocody', latitude: 5.360097, longitude: -3.985266 },
  { nom: 'ESIM YOPOUGON', commune: 'Yopougon', latitude: 5.332436, longitude: -4.081844 },
  { nom: 'ESIT 2 PLATEAU', commune: 'Cocody', latitude: 5.368759, longitude: -3.995723 },
  { nom: 'ESK 2 PLATEAUX ABIDJAN', commune: 'Cocody', latitude: 5.351619, longitude: -3.997216 },
  { nom: 'ESMCT (Ecole Supérieure Méthodiste de Commerce et de Technologie ) Ex CMAM-CI', commune: 'Cocody', latitude: 5.357808, longitude: -4.004529 },
  { nom: 'ESSC YOPOUGON ( SAINT CHALMEL)', commune: 'Yopougon', latitude: 5.335275, longitude: -4.080493 },
  { nom: 'ESTAN PLATEAU ABIDJAN', commune: 'Plateau', latitude: 5.329198, longitude: -4.022764 },
  { nom: 'ESTAN YOPOUGON', commune: 'Yopougon', latitude: 5.330064, longitude: -4.067714 },
  { nom: 'ESTC MARCORY ABIDJAN', commune: 'Marcory', latitude: 5.302468, longitude: -3.975021 },
  { nom: 'ESTC VRIDI', commune: 'Port-Bouët', latitude: 5.251934, longitude: -3.950185 },
  { nom: 'ESTC YOPOUGON ABIDJAN', commune: 'Yopougon', latitude: 5.337059, longitude: -4.069393 },
  { nom: 'ESTEAI RIVIERA BONOUMIN', commune: 'Cocody', latitude: 5.36747, longitude: -3.992503 },
  { nom: 'ETEP - ANNEXE YOPOUGON', commune: 'Yopougon', latitude: 5.340546, longitude: -4.074284 },
  { nom: 'ETEP ABOBO ABIDJAN', commune: 'Abobo', latitude: 5.420235, longitude: -4.022056 },
  { nom: 'ETEP ANNEXE RIVIERA', commune: 'Cocody', latitude: 5.361706, longitude: -3.98959 },
  { nom: 'EURO-FORMATION II PLATEAUX -(EUROF II PLATEAUX)', commune: 'Cocody', latitude: 5.359273, longitude: -3.998944 },
  { nom: 'EURO-FORMATION MARCORY -(EUROF MARCORY)', commune: 'Marcory', latitude: 5.304734, longitude: -3.994814 },
  { nom: 'EURO-FORMATION YOPOUGON -(EUROF YOPOUGON)', commune: 'Yopougon', latitude: 5.346567, longitude: -4.075745 },
  { nom: 'EXCELL SUP', commune: 'Cocody', latitude: 5.356287, longitude: -4.005075 },
  { nom: 'EXPERT-METIER BUSINESS SCHOOL', commune: 'Cocody', latitude: 5.361069, longitude: -3.987915 },
  { nom: 'Ecole Supérieure de Management La Perruche -(ESM LA PERRUCHE)', commune: 'Anyama', latitude: 5.488704, longitude: -4.043078 },
  { nom: 'Ecole Supérieure d’Interprétariat et de Traduction', commune: 'Cocody', latitude: 5.367068, longitude: -3.989602 },
  { nom: 'Entrepreneurs Business School', commune: 'Treichville', latitude: 5.310176, longitude: -3.997115 },
  { nom: 'GECI (GROUPE EXPERT) ABIDJAN', commune: 'Yopougon', latitude: 5.336574, longitude: -4.081365 },
  { nom: 'GECI GROUPE EXPERT ANNEXE YOPOUGON', commune: 'Yopougon', latitude: 5.333321, longitude: -4.07559 },
  { nom: 'GENERAL CONSEIL ET SERVICE YOPOUGON -(GECOS YOPOUGON)', commune: 'Yopougon', latitude: 5.326558, longitude: -4.075788 },
  { nom: 'GRADUATE SCHOOL OF MANAGEMENT -(GSM)', commune: 'Cocody', latitude: 5.353311, longitude: -3.99813 },
  { nom: 'GRAND GROUPE ELITES VISION -(2GEV)', commune: 'Yopougon', latitude: 5.328894, longitude: -4.081325 },
  { nom: 'GRANDE ECOLE D\'INFORMATIQUE ET DE GESTION D\'ENTREPRISE -(GEIGE)', commune: 'Cocody', latitude: 5.359293, longitude: -4.002101 },
  { nom: 'GROUPE CEFIAT ABIDJAN -(GROUPE CEFIAT ABIDJAN)', commune: 'Plateau', latitude: 5.317201, longitude: -4.024058 },
  { nom: 'GROUPE CEFIAT SALOMON -(GROUPE CEFIAT SALOMON)', commune: 'Plateau', latitude: 5.338961, longitude: -4.021398 },
  { nom: 'GROUPE CONCORDET BINGERVILLE -(ESGTC BINGERVILLE)', commune: 'Cocody', latitude: 5.361919, longitude: -3.98433 },
  { nom: 'GROUPE CONCORDET N\'DOTRE -(ESGTC N\'DOTRE)', commune: 'Abobo', latitude: 5.428373, longitude: -4.029691 },
  { nom: 'GROUPE CONSEILS ET STRATEGIES INTERNATIONAL POLE POLYTECHNIQUE -(GROUPE CSI PP)', commune: 'Cocody', latitude: 5.363273, longitude: -3.994866 },
  { nom: 'GROUPE D ENSEIGNEMENT SUPERIEUR ET PROFESSIONNEL D AGBE (GESSP)', commune: 'Abobo', latitude: 5.427061, longitude: -4.012473 },
  { nom: 'GROUPE DE FORMATION EN COMMERCE ET GESTION DES ENTREPRISES YOPOUGON -(GROUPE CGE YOPOUGON)', commune: 'Yopougon', latitude: 5.329508, longitude: -4.071476 },
  { nom: 'GROUPE ECOLE D\'ABIDJAN -(GEA)', commune: 'Cocody', latitude: 5.351054, longitude: -3.99806 },
  { nom: 'GROUPE ECOLE DE TECHNOLOGIE ET DE COMMERCE PORT-BOUËT -(GROUPE ETEC PORT-BOUËT)', commune: 'Port-Bouët', latitude: 5.256941, longitude: -3.966255 },
  { nom: 'GROUPE ECOLE DE TECHNOLOGIE ET DE COMMERCE YOPOUGON -(GROUPE ETEC YOPOUGON)', commune: 'Yopougon', latitude: 5.341882, longitude: -4.079234 },
  { nom: 'GROUPE ECOLE DES HAUTES ETUDES DE GESTION-ABIDJAN -(GROUPE EDHEG ABIDJAN)', commune: 'Cocody', latitude: 5.357591, longitude: -3.987251 },
  { nom: 'GROUPE ECOLE DES PROFESSIONS D\'AVENIR -(GROUPE EPRA)', commune: 'Yopougon', latitude: 5.339865, longitude: -4.075927 },
  { nom: 'GROUPE ECOLE DES SCIENCES APPLIQUEES ET GESTION DES ENTREPRISES D\'ABIDJAN PLATEAU -(GROUPE ESSA PLATEAU)', commune: 'Plateau', latitude: 5.339495, longitude: -4.023004 },
  { nom: 'GROUPE ECOLE ENTREPRISE EMPLOI PLATEAU -(GROUPE 3E PLATEAU)', commune: 'Plateau', latitude: 5.326395, longitude: -4.021349 },
  { nom: 'GROUPE ECOLE ENTREPRISE EMPLOI YOPOUGON -(GROUPE 3E YOPOUGON)', commune: 'Yopougon', latitude: 5.343223, longitude: -4.080935 },
  { nom: 'GROUPE ECOLE N\'GUETTIA (GEN)', commune: 'Port-Bouët', latitude: 5.247727, longitude: -3.954456 },
  { nom: 'GROUPE ECOLE SUPERIEURE DE COMMERCE DE GESTION ET DE TECHNOLOGIE COCODY -(GROUPE ESCOGET COCODY)', commune: 'Cocody', latitude: 5.356266, longitude: -3.985611 },
  { nom: 'GROUPE ECOLE SUPERIEURE DE COMMERCE DE GESTION ET DE TECHNOLOGIE PLATEAU -(GROUPE ESCOGET PLATEAU)', commune: 'Plateau', latitude: 5.324463, longitude: -4.029172 },
  { nom: 'GROUPE ECOLE SUPERIEURE INTERNATIONALE DE LA FORMATION PROFESSIONNELLE (GROUPE ESIFOP)', commune: 'Yopougon', latitude: 5.332557, longitude: -4.079384 },
  { nom: 'GROUPE ECOLES BETHEL -(GEB)', commune: 'Cocody', latitude: 5.361634, longitude: -3.98579 },
  { nom: 'GROUPE ECOLES D\'INGENIEURS AGITEL-FORMATION -(AGITEL)', commune: 'Cocody', latitude: 5.365053, longitude: -3.998184 },
  { nom: 'GROUPE ESC ABIDJAN', commune: 'Cocody', latitude: 5.349989, longitude: -3.993084 },
  { nom: 'GROUPE EXPERT METIER SA -(GEM SA)', commune: 'Cocody', latitude: 5.35089, longitude: -3.996479 },
  { nom: 'GROUPE INSTEC -(INSTEC)', commune: 'Treichville', latitude: 5.302004, longitude: -4.018951 },
  { nom: 'GROUPE ITA-INGENIERIE SA 2 PLATEAUX -(G2I 2 PLATEAUX)', commune: 'Cocody', latitude: 5.357442, longitude: -3.989171 },
  { nom: 'GROUPE ITA-INGENIERIE SA ANTENNE YOPOUGON -(G2I YOPOUGON)', commune: 'Yopougon', latitude: 5.333378, longitude: -4.065372 },
  { nom: 'GROUPE ITA-INGENIERIE SA MARCORY -(G2I MARCORY)', commune: 'Marcory', latitude: 5.306018, longitude: -3.976597 },
  { nom: 'GROUPE ITA-INGENIERIE SA RIVIERA-(G2I RIVIERA)', commune: 'Cocody', latitude: 5.355766, longitude: -4.003356 },
  { nom: 'GROUPE ITA-INGENIERIE SA YOPOUGON-(G2I YOPOUGON)', commune: 'Yopougon', latitude: 5.335732, longitude: -4.080816 },
  { nom: 'GROUPE IVOIRE ACADEMIE', commune: 'Yopougon', latitude: 5.325901, longitude: -4.073728 },
  { nom: 'GROUPE ONYX EXCELLENCE PLATEAU -(GOEP)', commune: 'Plateau', latitude: 5.322704, longitude: -4.020326 },
  { nom: 'GROUPE ONYX-EXCELLENCE YOPOUGON -(GOEY)', commune: 'Yopougon', latitude: 5.331918, longitude: -4.074672 },
  { nom: 'GROUPE PIGIER -CI YOPOUGON', commune: 'Yopougon', latitude: 5.339003, longitude: -4.079335 },
  { nom: 'GROUPE SUCCES FORMATION -(GSF)', commune: 'Yopougon', latitude: 5.328887, longitude: -4.072765 },
  { nom: 'GROUPE SUP FORMATION (GSF)', commune: 'Cocody', latitude: 5.347485, longitude: -3.99142 },
  { nom: 'Groupe d\'Enseignement Supérieur Technique et Professionnel de Côte d\'Ivoire (GESTPCI)', commune: 'Abobo', latitude: 5.422511, longitude: -4.027503 },
  { nom: 'HAUTE ETUDES DE COMMERCE ET D\'ADMINISTRATION DES ENTREPRISES YOPOUGON -(HEC-AD YOPOUGON)', commune: 'Yopougon', latitude: 5.344987, longitude: -4.081948 },
  { nom: 'HAUTES ETUDES COMMERCIALES LA ROCHE RIVERA -(HEC LA ROCHE RIVERA)', commune: 'Cocody', latitude: 5.349934, longitude: -3.985859 },
  { nom: 'HAUTES ETUDES EN GESTION, BANQUE ET ASSURANCE -(HEGES)', commune: 'Marcory', latitude: 5.307127, longitude: -3.984359 },
  { nom: 'HEC LA ROCHE PLATEAU ABIDJAN', commune: 'Plateau', latitude: 5.32327, longitude: -4.014301 },
  { nom: 'HETEC ABOBO', commune: 'Abobo', latitude: 5.429332, longitude: -4.021663 },
  { nom: 'HOREB BUSINESS AND FINANCE ET INSTITUT VICTOR HUGO D ABIDJAN (IVHA)', commune: 'Adjamé', latitude: 5.361378, longitude: -4.029413 },
  { nom: 'I2SMA', commune: 'Abobo', latitude: 5.432893, longitude: -4.02924 },
  { nom: 'IAM', commune: 'Cocody', latitude: 5.366845, longitude: -3.994688 },
  { nom: 'ICOGES ABIDJAN', commune: 'Cocody', latitude: 5.354726, longitude: -3.993502 },
  { nom: 'IFIT ADJAME ABIDJAN', commune: 'Adjamé', latitude: 5.345494, longitude: -4.03007 },
  { nom: 'IFORAS - COCODY -(IFORAS)', commune: 'Cocody', latitude: 5.364935, longitude: -3.998529 },
  { nom: 'IHEM-SO 2 PLATEAUX ABIDJAN', commune: 'Cocody', latitude: 5.36016, longitude: -4.002139 },
  { nom: 'IHETT', commune: 'Yopougon', latitude: 5.329664, longitude: -4.071721 },
  { nom: 'IHPT TREICHVILLE', commune: 'Plateau', latitude: 5.32316, longitude: -4.011562 },
  { nom: 'IMCC ABIDJAN', commune: 'Yopougon', latitude: 5.331584, longitude: -4.071209 },
  { nom: 'IMOTEP ACADEMIE', commune: 'Cocody', latitude: 5.355781, longitude: -4.000749 },
  { nom: 'INSTITU DE FORMATION AUX METIERS YOPOUGON (IMF YOPOUGON )', commune: 'Yopougon', latitude: 5.329745, longitude: -4.076258 },
  { nom: 'INSTITUT AFRICAIN DU NUMERIQUE (IAN)', commune: 'Cocody', latitude: 5.355251, longitude: -4.00184 },
  { nom: 'INSTITUT BOOSTER AFRIQUE', commune: 'Cocody', latitude: 5.351462, longitude: -3.985405 },
  { nom: 'INSTITUT CERCO ABIDJAN', commune: 'Cocody', latitude: 5.354904, longitude: -3.990994 },
  { nom: 'INSTITUT D\'ENSEIGNEMENT SUPERIEUR LE CAMPUS COCODY -(IES-LE CAMPUS COCODY)', commune: 'Cocody', latitude: 5.353712, longitude: -3.994066 },
  { nom: 'INSTITUT D\'ENSEIGNEMENT SUPERIEUR LE CAMPUS YOPOUGON -(IES-LE CAMPUS YOPOUGON)', commune: 'Yopougon', latitude: 5.336174, longitude: -4.083066 },
  { nom: 'INSTITUT D\'ENSEIGNEMENT SUPERIEUR OFFOUMOU YOPOUGON -(IESO YOPOUGON)', commune: 'Yopougon', latitude: 5.32525, longitude: -4.073148 },
  { nom: 'INSTITUT D\'ETUDES SUPERIEURES D4ABIDJAN -(IESA)', commune: 'Cocody', latitude: 5.347071, longitude: -3.994864 },
  { nom: 'INSTITUT DE COMMUNICATION DE GESTION ET D\'ETUDE SCIENTIFIQUE PLATEAU -(ICOGES PLATEAU)', commune: 'Plateau', latitude: 5.330248, longitude: -4.032356 },
  { nom: 'INSTITUT DE FORMATION ARTS ET DEVELOPPEMENT -(IFAD)', commune: 'Plateau', latitude: 5.320455, longitude: -4.018803 },
  { nom: 'INSTITUT DE FORMATION DOUMBIA TOUMANY MUHAMMAD -(IF-DTM)', commune: 'Yopougon', latitude: 5.324992, longitude: -4.073789 },
  { nom: 'INSTITUT DE FORMATION ET D\'ENSEIGNEMENT SUPERIEUR -(IFES)', commune: 'Yopougon', latitude: 5.341879, longitude: -4.075725 },
  { nom: 'INSTITUT DE FORMATION PROFESSIONNELLE ET GENERALE/INSTITUT SUPERIEUR DE FORMATION TECHNIQUE ET PROFESSIONNELLE PLATEAU -(IFPG/ISFPT PLATEAU)', commune: 'Plateau', latitude: 5.326158, longitude: -4.023169 },
  { nom: 'INSTITUT DE FORMATION SAINTE MARIE ABOBO BAOULE -(IFSM ABOBO BAOULE)', commune: 'Abobo', latitude: 5.422935, longitude: -4.028328 },
  { nom: 'INSTITUT DE FORMATION SAINTE MARIE ABOBO CAMP COMMANDO -(IFSM ABOBO CAMP COMMANDO)', commune: 'Abobo', latitude: 5.418933, longitude: -4.029056 },
  { nom: 'INSTITUT DE FORMATION SAINTE MARIE ABOBO MARAHOUE -(IFSM ABOBO MARAHOUE)', commune: 'Abobo', latitude: 5.424671, longitude: -4.009143 },
  { nom: 'INSTITUT DE FORMATION SAINTE MARIE ADJAME -(IFSM ADJAME)', commune: 'Adjamé', latitude: 5.349775, longitude: -4.018406 },
  { nom: 'INSTITUT DE FORMATION SAINTE MARIE ANGRE -(IFSM ANGRE)', commune: 'Cocody', latitude: 5.353462, longitude: -3.998022 },
  { nom: 'INSTITUT DE FORMATION SAINTE MARIE ANYAMA (IFSM ANYAMA)', commune: 'Anyama', latitude: 5.491548, longitude: -4.054091 },
  { nom: 'INSTITUT DE FORMATION SAINTE MARIE AZITO (IFSM AZITO)', commune: 'Yopougon', latitude: 5.329438, longitude: -4.081474 },
  { nom: 'INSTITUT DE FORMATION SAINTE MARIE COCODY -(IFSM COCODY CHU)', commune: 'Cocody', latitude: 5.363861, longitude: -3.998149 },
  { nom: 'INSTITUT DE FORMATION SAINTE MARIE COCODY -(IFSM COCODY)', commune: 'Cocody', latitude: 5.365439, longitude: -3.993639 },
  { nom: 'INSTITUT DE FORMATION SAINTE MARIE KOUMASSI -(IFSM KOUMASSI)', commune: 'Koumassi', latitude: 5.284771, longitude: -3.95233 },
  { nom: 'INSTITUT DE FORMATION SAINTE MARIE PORT BOUET (IFSM PORT BOUET)', commune: 'Port-Bouët', latitude: 5.254497, longitude: -3.952063 },
  { nom: 'INSTITUT DE FORMATION SAINTE MARIE YOPOUGON -(IFSM YOPOUGON)', commune: 'Yopougon', latitude: 5.326191, longitude: -4.068334 },
  { nom: 'INSTITUT DE FORMATION SAINTE MARIE YOPOUGON ANDOKOI -(IFSM YOPOUGON ANDOKOI)', commune: 'Yopougon', latitude: 5.32664, longitude: -4.068911 },
  { nom: 'INSTITUT DE FORMATIONS PROFESSIONNELLES KADI\'S RAOUDA -(IFP KADI\'S RAOUDA ANYAMA)', commune: 'Anyama', latitude: 5.487238, longitude: -4.053873 },
  { nom: 'INSTITUT DE FORMATIONS PROFESSIONNELLES KADI\'S RAOUDA -(IFP KADI\'S RAOUDA)', commune: 'Cocody', latitude: 5.34969, longitude: -3.988369 },
  { nom: 'INSTITUT DE MANAGEMENT ET DES ETUDES D\'ADMINISTRATION (IMEA) COCODY', commune: 'Cocody', latitude: 5.350832, longitude: -3.997672 },
  { nom: 'INSTITUT DE MANAGEMENT, DE GESTION ET DE L HOTELLERIE (IMGH)', commune: 'Yopougon', latitude: 5.345455, longitude: -4.07588 },
  { nom: 'INSTITUT DE RECHERCHE EN SECURITE ET PROTECTION DE L\'ENVIRONNEMENT -(IRSPE KIBIO)', commune: 'Cocody', latitude: 5.354235, longitude: -3.991251 },
  { nom: 'INSTITUT DE SPECIALITES ET DE CLASSES PREPARATOIRES - INSCP', commune: 'Cocody', latitude: 5.352614, longitude: -3.991108 },
  { nom: 'INSTITUT DE TECHNOLOGIE AURELS (IT AURELS)', commune: 'Abobo', latitude: 5.419335, longitude: -4.021183 },
  { nom: 'INSTITUT DE TECHNOLOGIES ET SPECIALITES -(ITES)', commune: 'Cocody', latitude: 5.366838, longitude: -3.997043 },
  { nom: 'INSTITUT DES HAUTES ETUDES COMMERCIALES D\'ABIDJAN -(IHEC ABIDJAN)', commune: 'Cocody', latitude: 5.354106, longitude: -3.996371 },
  { nom: 'INSTITUT DES HAUTES ETUDES PROFESSIONNELLES AFRIQUE -(IHEP AFRIQUE)', commune: 'Cocody', latitude: 5.366313, longitude: -3.994956 },
  { nom: 'INSTITUT DES HAUTES ETUDES SUPERIEURES AVICENNE -(IHES AVICENNE)', commune: 'Cocody', latitude: 5.355038, longitude: -4.000514 },
  { nom: 'INSTITUT DES SCIENCES APPLIQUEES ET DE TECHNOLOGIE -(ISATECH)', commune: 'Koumassi', latitude: 5.292492, longitude: -3.969538 },
  { nom: 'INSTITUT DES SCIENCES ET INGENIERIES DE DEVELOPPEMENT -(ISID)', commune: 'Cocody', latitude: 5.351872, longitude: -4.002994 },
  { nom: 'INSTITUT DES SCIENCES INFORMATIQUE ET DE GESTION (ISIG) YOPOUGON', commune: 'Yopougon', latitude: 5.337331, longitude: -4.065121 },
  { nom: 'INSTITUT DES TECHNOLOGIES D\'ABIDJAN (ITA ABOBO)', commune: 'Abobo', latitude: 5.416831, longitude: -4.02276 },
  { nom: 'INSTITUT FAMAH ANGRE -(IF ANGRE)', commune: 'Cocody', latitude: 5.361347, longitude: -3.989023 },
  { nom: 'INSTITUT FAMAH BONOUMIN -(IF BONOUMIN)', commune: 'Cocody', latitude: 5.35971, longitude: -3.986035 },
  { nom: 'INSTITUT FAMAH COCODY VALLON (IF COCODY VALLON)', commune: 'Cocody', latitude: 5.354907, longitude: -4.004571 },
  { nom: 'INSTITUT FAMAH MARCORY -(IF MARCORY)', commune: 'Marcory', latitude: 5.309061, longitude: -3.991365 },
  { nom: 'INSTITUT FAMAH PORT-BOUËT -(IF PORT-BOUËT) ABIDJAN', commune: 'Port-Bouët', latitude: 5.26139, longitude: -3.967591 },
  { nom: 'INSTITUT FAMAH RIVIERA ATTOBAN (IF ATTOBAN)', commune: 'Cocody', latitude: 5.352774, longitude: -3.987135 },
  { nom: 'INSTITUT FAMAH YOPOUGON MILLIONNAIRE -(IF YOPOUGON MILLIONNAIRE)', commune: 'Yopougon', latitude: 5.337704, longitude: -4.073267 },
  { nom: 'INSTITUT FINAK DE SONGON', commune: 'Songon', latitude: 5.333506, longitude: -4.198773 },
  { nom: 'INSTITUT IMPERIAL -(2I)', commune: 'Cocody', latitude: 5.360087, longitude: -4.0032 },
  { nom: 'INSTITUT INTERNATIONAL D\'ADMINISTRATION ET DE MANAGEMENT -(2IAM)', commune: 'Cocody', latitude: 5.363033, longitude: -3.988225 },
  { nom: 'INSTITUT INTERNATIONAL DE FORMATION EN ENTREPRENEURIAT-2IAE RIVIERA PALMERAIE -(2IFE-2IAE RIVIERA PALMERAIE)', commune: 'Cocody', latitude: 5.364962, longitude: -3.998733 },
  { nom: 'INSTITUT INTERNATIONAL DE FORMATION EN ENTREPRENEURIAT-2IAE YOPOUGON -(2IFE-2IAE YOPOUGON)', commune: 'Yopougon', latitude: 5.342652, longitude: -4.066903 },
  { nom: 'INSTITUT INTERNATIONAL DE TECHNOLOGIE SUPERIEURE -(2ITS)', commune: 'Cocody', latitude: 5.364133, longitude: -4.002649 },
  { nom: 'INSTITUT INTERNATIONAL DES ARTS ET METIERS DE COTE D IVOIRE (2IAM)', commune: 'Cocody', latitude: 5.355973, longitude: -4.003362 },
  { nom: 'INSTITUT INTERNATIONAL DES SCIENCES ET DES ARTS DU NUMERQIUE (IISAN)', commune: 'Cocody', latitude: 5.351646, longitude: -4.000856 },
  { nom: 'INSTITUT INTERNATIONAL POLYTECHNIQUE DES ELITES D\'ABIDJAN (IIPEA ABOBO)', commune: 'Abobo', latitude: 5.421545, longitude: -4.017698 },
  { nom: 'INSTITUT INTERNATIONAL POLYTECHNIQUE DES ELITES D\'ABIDJAN (IIPEA ANGRE)', commune: 'Cocody', latitude: 5.350219, longitude: -4.003321 },
  { nom: 'INSTITUT INTERNATIONAL POLYTECHNIQUE DES ELITES D\'ABIDJAN (IIPEA KOUMASSI)', commune: 'Koumassi', latitude: 5.292329, longitude: -3.965393 },
  { nom: 'INSTITUT INTERNATIONAL POLYTECHNIQUE DES ELITES D\'ABIDJAN (IIPEA PORT BOUET)', commune: 'Port-Bouët', latitude: 5.260976, longitude: -3.953432 },
  { nom: 'INSTITUT INTERNATIONAL POLYTECHNIQUE DES ELITES D\'ABIDJAN (IIPEA RIVIERA)', commune: 'Cocody', latitude: 5.353888, longitude: -3.996576 },
  { nom: 'INSTITUT INTERNATIONAL POLYTECHNIQUE DES ELITES D\'ABIDJAN (IIPEA YOPOUGON)', commune: 'Yopougon', latitude: 5.324734, longitude: -4.08074 },
  { nom: 'INSTITUT INTERNATIONAL POLYTECHNIQUE DES ELITES D\'ABIDJAN (IIPEA)', commune: 'Cocody', latitude: 5.35462, longitude: -3.995444 },
  { nom: 'INSTITUT IRAO COCODY -(IRAO COCODY)', commune: 'Cocody', latitude: 5.358368, longitude: -3.990876 },
  { nom: 'INSTITUT IRAO YOPOUGON -(IRAO YOPOUGON)', commune: 'Yopougon', latitude: 5.345512, longitude: -4.071254 },
  { nom: 'INSTITUT LEGACY PLATEAU ABIDJAN', commune: 'Plateau', latitude: 5.325869, longitude: -4.022978 },
  { nom: 'INSTITUT LKM YOPOUGON ABIDJAN', commune: 'Yopougon', latitude: 5.337806, longitude: -4.085212 },
  { nom: 'INSTITUT POLYTECHNIQUE DU SUD -(IPS)', commune: 'Cocody', latitude: 5.366007, longitude: -3.992156 },
  { nom: 'INSTITUT POLYTECHNIQUE INTERNATIONALE FRANÇOIS -(IPIF)', commune: 'Cocody', latitude: 5.365052, longitude: -3.993266 },
  { nom: 'INSTITUT POLYVALENT DES AFFAIRES ET DU MANAGEMENT (IPAM)', commune: 'Cocody', latitude: 5.360266, longitude: -3.985187 },
  { nom: 'INSTITUT PRESBYTERIEN DE COTE D\'IVOIRE', commune: 'Yopougon', latitude: 5.330112, longitude: -4.067861 },
  { nom: 'INSTITUT PRIVE SIATA (IP - SIATA)', commune: 'Yopougon', latitude: 5.344051, longitude: -4.080257 },
  { nom: 'INSTITUT PROSELYTE -(IP)', commune: 'Yopougon', latitude: 5.342265, longitude: -4.075066 },
  { nom: 'INSTITUT SACRE COEUR -(ISC)', commune: 'Cocody', latitude: 5.350648, longitude: -3.991356 },
  { nom: 'INSTITUT SUPEREIRUR DE GESTION D\'ECONOMIE ET DE MANAGEMENT -(ISGEMA)', commune: 'Cocody', latitude: 5.362258, longitude: -3.99507 },
  { nom: 'INSTITUT SUPERIEUR DES SCIENCES APPLIQUEES -(INSSA)', commune: 'Cocody', latitude: 5.350988, longitude: -3.992794 },
  { nom: 'INSTITUT SUPERIEUR ADAM MARSHALL (ISAM) YOPOUGON', commune: 'Yopougon', latitude: 5.335228, longitude: -4.084654 },
  { nom: 'INSTITUT SUPERIEUR ADAM MARSHALL PLATEAU', commune: 'Plateau', latitude: 5.327177, longitude: -4.013761 },
  { nom: 'INSTITUT SUPERIEUR AKANDJI (IS AKANDJI)', commune: 'Cocody', latitude: 5.364463, longitude: -3.996535 },
  { nom: 'INSTITUT SUPERIEUR ARC-EN-CIEL -(ISA)', commune: 'Cocody', latitude: 5.349473, longitude: -4.003299 },
  { nom: 'INSTITUT SUPERIEUR BLAISE PASCAL BINGERVILLE -(ISBP)', commune: 'Bingerville', latitude: 5.35013, longitude: -3.894647 },
  { nom: 'INSTITUT SUPERIEUR BOSOL (ISB ABIDJAN)', commune: 'Cocody', latitude: 5.359547, longitude: -3.996065 },
  { nom: 'INSTITUT SUPERIEUR D\'ADMINISTRATION D\'ENTREPRISE -(ISAE ABIDJAN)', commune: 'Cocody', latitude: 5.347047, longitude: -3.994934 },
  { nom: 'INSTITUT SUPERIEUR DE COMMERCE D\'ADMINISTRATION ET DE TECHNOLOGIE -(ISCAT)', commune: 'Cocody', latitude: 5.355495, longitude: -3.992603 },
  { nom: 'INSTITUT SUPERIEUR DE COMMERCE ET D\'ADMINISTRATION DES ENTREPRISES (ISCAE) ABIDJAN', commune: 'Yopougon', latitude: 5.332286, longitude: -4.086058 },
  { nom: 'INSTITUT SUPERIEUR DE COMMERCE ET DE MANAGEMENT -(ISCM)', commune: 'Cocody', latitude: 5.351097, longitude: -4.000487 },
  { nom: 'INSTITUT SUPERIEUR DE COMMERCE ET DE MANAGEMENT MAERIFA (ISCM MAERIFA)', commune: 'Abobo', latitude: 5.431121, longitude: -4.019269 },
  { nom: 'INSTITUT SUPERIEUR DE COMMERCE, D\'AGRICULTURE ET DE NOUVELLES TECHNOLOGIES -(ISCANT)', commune: 'Cocody', latitude: 5.350786, longitude: -3.993175 },
  { nom: 'INSTITUT SUPERIEUR DE FORMATION APPLIQUEE (ISFA)', commune: 'Abobo', latitude: 5.424825, longitude: -4.022892 },
  { nom: 'INSTITUT SUPERIEUR DE FORMATION AUX METIERS DE L\'INFORMATIQUE -(ISFMI)', commune: 'Plateau', latitude: 5.338581, longitude: -4.025887 },
  { nom: 'INSTITUT SUPERIEUR DE FORMATION ELITE TECHNOLOGIE YOPOUGON NIANGON -(ISF-ELITECH)', commune: 'Yopougon', latitude: 5.336165, longitude: -4.082827 },
  { nom: 'INSTITUT SUPERIEUR DE FORMATION EN COMMERCE ET GESTION D\'ABIDJAN -(ISFCG)', commune: 'Cocody', latitude: 5.358078, longitude: -4.002203 },
  { nom: 'INSTITUT SUPERIEUR DE FORMATION ET D\'INNOVATION D\'ABIDJAN - ISFIA', commune: 'Cocody', latitude: 5.352853, longitude: -3.998527 },
  { nom: 'INSTITUT SUPERIEUR DE FORMATION POUR LE DEVELOPPEMENT DES COMPETENCES (ISDEC)', commune: 'Abobo', latitude: 5.417405, longitude: -4.016156 },
  { nom: 'INSTITUT SUPERIEUR DE FORMATION SIBATA -(ISFOS)', commune: 'Yopougon', latitude: 5.340812, longitude: -4.079561 },
  { nom: 'INSTITUT SUPERIEUR DE GESTION DES ENTREPRISES (ISGE)', commune: 'Cocody', latitude: 5.360216, longitude: -3.997765 },
  { nom: 'INSTITUT SUPERIEUR DE GESTION ET DU BATIMENT -(ISG BAT)', commune: 'Yopougon', latitude: 5.34254, longitude: -4.069714 },
  { nom: 'INSTITUT SUPERIEUR DE LA CULTURE ET DES ARTS -(INSCA)', commune: 'Cocody', latitude: 5.350313, longitude: -4.003401 },
  { nom: 'INSTITUT SUPERIEUR DE MANAGEMENT ADONAÏ -(ISM ADONAÏ)', commune: 'Cocody', latitude: 5.355447, longitude: -3.991774 },
  { nom: 'INSTITUT SUPERIEUR DE MARKETING ET DE COMPTABILITE COCODY -(ISMC COCODY)', commune: 'Cocody', latitude: 5.356492, longitude: -4.005413 },
  { nom: 'INSTITUT SUPERIEUR DE STATISTIQUE D\'ECONOMETRIE ET DE DATA SCIENCE -(INSSEDS)', commune: 'Cocody', latitude: 5.364395, longitude: -3.989437 },
  { nom: 'INSTITUT SUPERIEUR DE TECHNOLOGIE DE COTE D\'IVOIRE COCODY -(ISTCI COCODY)', commune: 'Cocody', latitude: 5.354203, longitude: -3.991277 },
  { nom: 'INSTITUT SUPERIEUR DE TECHNOLOGIE DE COTE D\'IVOIRE PLATEAU -(ISTCI PLATEAU)', commune: 'Plateau', latitude: 5.325046, longitude: -4.017629 },
  { nom: 'INSTITUT SUPERIEUR DE TECHNOLOGIE DE COTE D\'IVOIRE YOPOUGON -(ISTCI YOPOUGON)', commune: 'Yopougon', latitude: 5.33649, longitude: -4.083958 },
  { nom: 'INSTITUT SUPERIEUR DE TECHNOLOGIE DUBASS -(IST-DUBASS)', commune: 'Cocody', latitude: 5.363994, longitude: -3.994688 },
  { nom: 'INSTITUT SUPERIEUR DE TECHNOLOGIE ET PROFESSIONNEL (ISTP) YOPOUGON', commune: 'Yopougon', latitude: 5.326688, longitude: -4.079549 },
  { nom: 'INSTITUT SUPERIEUR DE TECHNOLOGIE LAMA FOFANA (ISTLAF)', commune: 'Yopougon', latitude: 5.344685, longitude: -4.074903 },
  { nom: 'INSTITUT SUPERIEUR DE TECHNOLOGIES APPLIQUEES ET COMMERCIALES', commune: 'Yopougon', latitude: 5.326517, longitude: -4.076427 },
  { nom: 'INSTITUT SUPERIEUR DES CARRIERES COMMERCIALES COCODY -(ISCC COCODY)', commune: 'Cocody', latitude: 5.35871, longitude: -3.998215 },
  { nom: 'INSTITUT SUPERIEUR DES CARRIERES COMMERCIALES TREICHVILLE -(ISCC TREICHVILLE)', commune: 'Treichville', latitude: 5.308841, longitude: -4.001015 },
  { nom: 'INSTITUT SUPERIEUR DES METIERS DE GESTION ET DE TECHNOLOGIE -(ISMGT)', commune: 'Cocody', latitude: 5.357003, longitude: -4.001403 },
  { nom: 'INSTITUT SUPERIEUR DES NOUVELLES TECHNOLOGIES ET DE GESTION - GROUPE SEGBE', commune: 'Yopougon', latitude: 5.336793, longitude: -4.07668 },
  { nom: 'INSTITUT SUPERIEUR DES SCIENCES DE L AGRICULTURE ET DE L ALIMENTATION (INSSA-AL EPHRATA)', commune: 'Cocody', latitude: 5.364792, longitude: -4.000583 },
  { nom: 'INSTITUT SUPERIEUR DES SCIENCES ET DE GESTION -(IS2G)', commune: 'Yopougon', latitude: 5.33568, longitude: -4.080439 },
  { nom: 'INSTITUT SUPERIEUR DES TECHNIQUES COMPTABLES, JURIDIQUES ET FISCALES COCODY -(ISTCJF COCODY)', commune: 'Cocody', latitude: 5.362045, longitude: -3.985363 },
  { nom: 'INSTITUT SUPERIEUR DES TECHNOLOGIES ET DE MANAGEMENT ABIDJAN (ISTEMA PLATEAU)', commune: 'Plateau', latitude: 5.329455, longitude: -4.015001 },
  { nom: 'INSTITUT SUPERIEUR DES TECHNOLOGIES ET DE MANAGEMENT ABIDJAN-(ISTEMA YOPOUGON)', commune: 'Yopougon', latitude: 5.339962, longitude: -4.065417 },
  { nom: 'INSTITUT SUPERIEUR DES TECHNOLOGIES ET DE MANAGEMENT COCODY-(ISTM COCODY)', commune: 'Cocody', latitude: 5.364579, longitude: -3.993903 },
  { nom: 'INSTITUT SUPERIEUR DES TECHNOLOGIES ET DE MANAGEMENT PLATEAU -(ISTM PLATEAU)', commune: 'Plateau', latitude: 5.324088, longitude: -4.019456 },
  { nom: 'INSTITUT SUPERIEUR DES TECHNOLOGIES ET DE MANAGEMENT YOPOUGON -(ISTM YOPOUGON)', commune: 'Yopougon', latitude: 5.338198, longitude: -4.086236 },
  { nom: 'INSTITUT SUPERIEUR DJEKAT IGNACE DE LOYOLA -(ISDIL)', commune: 'Bingerville', latitude: 5.358268, longitude: -3.889589 },
  { nom: 'INSTITUT SUPERIEUR EZ', commune: 'Abobo', latitude: 5.425751, longitude: -4.027296 },
  { nom: 'INSTITUT SUPERIEUR FADETTE 2 (ISF 2)', commune: 'Yopougon', latitude: 5.331221, longitude: -4.080505 },
  { nom: 'INSTITUT SUPERIEUR FRED ET POPEE/EP2059', commune: 'Cocody', latitude: 5.364084, longitude: -3.992637 },
  { nom: 'INSTITUT SUPERIEUR GNIRA-CI (IS GNIRA-CI)', commune: 'Yopougon', latitude: 5.334765, longitude: -4.0864 },
  { nom: 'INSTITUT SUPERIEUR GRACE MARIE -(ISGM)', commune: 'Koumassi', latitude: 5.287184, longitude: -3.96206 },
  { nom: 'INSTITUT SUPERIEUR JONATHAN LEVIS (ISJL)', commune: 'Cocody', latitude: 5.351735, longitude: -3.987043 },
  { nom: 'INSTITUT SUPERIEUR KLEYS -(KLEYS)', commune: 'Cocody', latitude: 5.363103, longitude: -3.993343 },
  { nom: 'INSTITUT SUPERIEUR LE FROMAGER -(IS LE FROMAGER)', commune: 'Cocody', latitude: 5.357661, longitude: -4.005936 },
  { nom: 'INSTITUT SUPERIEUR LE PONT NEUF (ISLPN)', commune: 'Cocody', latitude: 5.356453, longitude: -3.994566 },
  { nom: 'INSTITUT SUPERIEUR LOWMAMNESS -(ISL YOPOUGON)', commune: 'Yopougon', latitude: 5.32487, longitude: -4.080726 },
  { nom: 'INSTITUT SUPERIEUR MICHEL ZADI (ISMZ)', commune: 'Yopougon', latitude: 5.330009, longitude: -4.07389 },
  { nom: 'INSTITUT SUPERIEUR NACHA AHMED DANIEL (ISNAD)', commune: 'Cocody', latitude: 5.356585, longitude: -3.988057 },
  { nom: 'INSTITUT SUPERIEUR NANAN THERESE -(ISNT)', commune: 'Plateau', latitude: 5.323934, longitude: -4.030657 },
  { nom: 'INSTITUT SUPERIEUR NATHAN YOPOUGON (ISNY)', commune: 'Yopougon', latitude: 5.325142, longitude: -4.075166 },
  { nom: 'INSTITUT SUPERIEUR POLYTECHNIQUE D\'AFRIQUE (ISPA)', commune: 'Cocody', latitude: 5.364883, longitude: -3.990655 },
  { nom: 'INSTITUT SUPERIEUR POLYTECHNIQUE ROOSEVELT (ISPR)', commune: 'Abobo', latitude: 5.430194, longitude: -4.010567 },
  { nom: 'INSTITUT SUPERIEUR POLYTECHNIQUE WASSA COCODY -(ISP WASSA COCODY)', commune: 'Cocody', latitude: 5.354347, longitude: -3.992756 },
  { nom: 'INSTITUT SUPERIEUR PROFESSIONNEL -(ISP)', commune: 'Abobo', latitude: 5.416461, longitude: -4.018567 },
  { nom: 'INSTITUT SUPERIEUR PROFESSIONNEL NOTRE DAME DE LA PAIX TREICHVILLE -(ISP NDP TREICHVILLE)', commune: 'Treichville', latitude: 5.305998, longitude: -4.002171 },
  { nom: 'INSTITUT SUPERIEUR SAINT CYRILLE (I2SC ABOBO)', commune: 'Abobo', latitude: 5.425604, longitude: -4.028204 },
  { nom: 'INSTITUT SUPERIEUR SAINT CYRILLE -(I2SC)', commune: 'Yopougon', latitude: 5.333924, longitude: -4.065613 },
  { nom: 'INSTITUT SUPERIEUR SAINT JAURES -(IS2J)', commune: 'Abobo', latitude: 5.419359, longitude: -4.019114 },
  { nom: 'INSTITUT SUPERIEUR SAINT MICHEL ANYAMA', commune: 'Anyama', latitude: 5.501397, longitude: -4.05366 },
  { nom: 'INSTITUT SUPERIEUR SAINTE FOI ABIDJAN -(ISSF ABIDJAN)', commune: 'Abobo', latitude: 5.424084, longitude: -4.025545 },
  { nom: 'INSTITUT SUPERIEUR SEPI -(IS YOPOUGON)', commune: 'Yopougon', latitude: 5.339261, longitude: -4.073261 },
  { nom: 'INSTITUT SUPERIEUR TECHNIQUE LA COLOMBE -(IST LA COLOMBE)', commune: 'Koumassi', latitude: 5.299143, longitude: -3.967917 },
  { nom: 'INSTITUT SUPERIEUR TECHNIQUE SAINT JACQUES -(IST St JACQUES)', commune: 'Cocody', latitude: 5.366012, longitude: -3.993956 },
  { nom: 'INSTITUT SUPERIEURE DE TECHNOLOGIE ET PROFESSIONNEL YOPOUGON -(ISTP YOPOUGON)', commune: 'Yopougon', latitude: 5.328275, longitude: -4.079686 },
  { nom: 'INSTITUT SUPÉRIEUR ADAM MARSHALL ABOBO', commune: 'Abobo', latitude: 5.421576, longitude: -4.017774 },
  { nom: 'INSTITUT SUPÉRIEUR DE FORMATION DES OPTICIENS -(ISFOP -OPTIQUE LOKO)', commune: 'Plateau', latitude: 5.324938, longitude: -4.032092 },
  { nom: 'INSTITUT SUPÉRIEUR DE FORMATION PROFESSIONNELLE ZONE 4C -(ISFOP Z4C) - GROUPE LOKO', commune: 'Marcory', latitude: 5.311513, longitude: -3.982502 },
  { nom: 'INSTITUT SUPÉRIEUR DE GESTION YOH -(ISG YOH)', commune: 'Cocody', latitude: 5.362656, longitude: -3.994097 },
  { nom: 'INSTITUT SUPÉRIEUR JEAN PAUL II -(ISJP 2) - GROUPE LOKO', commune: 'Yopougon', latitude: 5.326406, longitude: -4.070683 },
  { nom: 'INSTITUT SUPÉRIEUR LA FONTAINE -(ISLF) - GROUPE LOKO', commune: 'Marcory', latitude: 5.296082, longitude: -3.981237 },
  { nom: 'INSTITUT SUPÉRIEUR LE PROGRES -(ISLP) - GROUPE LOKO', commune: 'Marcory', latitude: 5.301517, longitude: -3.984279 },
  { nom: 'INSTITUT SUPÉRIEUR TERTIAIRE ET DE TECHNOLOGIE AVANCÉE -(ISTTA) - GROUPE LOKO', commune: 'Marcory', latitude: 5.304881, longitude: -3.978317 },
  { nom: 'INSTITUT SUP√âRIEUR DE FORMATION TECHNIQUE ET TERTIAIRE YOPOUGON -(ISFOTT)', commune: 'Yopougon', latitude: 5.326881, longitude: -4.078787 },
  { nom: 'INSTITUT TECHNIQUE ET PROFESSIONNEL - CERIN -(ITP - CERIN)', commune: 'Yopougon', latitude: 5.335943, longitude: -4.073568 },
  { nom: 'INSTITUT UNIVERSITAIRE DE TECHNOLOGIE ACADEMIA (IUT-A)', commune: 'Cocody', latitude: 5.352939, longitude: -3.99339 },
  { nom: 'INSTITUT UNIVERSITAIRE DE TECHNOLOGIE D\'ABIDJAN COCODY -(IUT ABIDJAN COCODY)', commune: 'Cocody', latitude: 5.36715, longitude: -3.996079 },
  { nom: 'INSTITUT UNIVERSITAIRE DE TECHNOLOGIE D\'ABIDJAN YOPOUGON -(IUT ABIDJAN YOPOUGON)', commune: 'Yopougon', latitude: 5.330131, longitude: -4.077384 },
  { nom: 'INSTITUT UNIVERSITAIRE DES HAUTES ETUDES PROFESSIONNELLES (IUHEP)', commune: 'Cocody', latitude: 5.352116, longitude: -4.000065 },
  { nom: 'INSTITUT UNIVERSITAIRE DES SCIENCES DE LA SANTE ET DE L ENVIRONNEMENT (IUSSE)', commune: 'Marcory', latitude: 5.313449, longitude: -3.988648 },
  { nom: 'INSTITUT UNIVERSITAIRE DES SCIENCES DE LA SANTE ET DE L ENVIRONNEMENT (IUSSE-AT)', commune: 'Bingerville', latitude: 5.364109, longitude: -3.892672 },
  { nom: 'INSTITUT UNIVERSITAIRE DU BATIMENT ET DES TRAVAUX PUBLICS (IUBTP)', commune: 'Cocody', latitude: 5.362116, longitude: -3.985674 },
  { nom: 'INSTITUT UNIVERSITAIRE POLYTECHNIQUE D\'ABIDJAN YOPOUGON -(IUPA YOPOUGON)', commune: 'Yopougon', latitude: 5.336636, longitude: -4.07449 },
  { nom: 'INSTITUT VOLTAIRE D\'ENSEIGNEMENT SUPERIEUR TECHNIQUE ET PROFESSIONNEL MARCORY -(IVESTP MARCORY)', commune: 'Marcory', latitude: 5.294645, longitude: -3.97879 },
  { nom: 'INSTITUT VOLTAIRE D\'ENSEIGNEMENT SUPERIEUR TECHNIQUE ET PROFESSIONNEL TREICHVILLE -(IVESTP TREICHVILLE)', commune: 'Treichville', latitude: 5.299573, longitude: -4.013513 },
  { nom: 'INSTITUT-CONSERVATOIRE DES SCIENCES DE GESTION DE COCODY -(ICS COCODY)', commune: 'Cocody', latitude: 5.359143, longitude: -3.997355 },
  { nom: 'INTELLECT AFRIQUE -(IA)', commune: 'Marcory', latitude: 5.303565, longitude: -3.977931 },
  { nom: 'INTERNATIONAL BUSINESS SCHOOL COTE D\'IVOIRE -(IBS-CI)', commune: 'Treichville', latitude: 5.312385, longitude: -4.006753 },
  { nom: 'INTERNATIONAL INSTITUTE OF MINES PETROLEUM AND ENERGY (2IMPE)', commune: 'Cocody', latitude: 5.348703, longitude: -4.002241 },
  { nom: 'INTERNATIONAL MANAGEMENT BUSINESS SCHOOL (IMBS)', commune: 'Yopougon', latitude: 5.326552, longitude: -4.081174 },
  { nom: 'IPAC PLATEAU ABIDJAN', commune: 'Cocody', latitude: 5.365324, longitude: -4.002423 },
  { nom: 'IPB 2 PLATEAUX ABIDJAN', commune: 'Cocody', latitude: 5.351976, longitude: -4.00433 },
  { nom: 'ISAB (Institut Supérieur Africain d’Assurances Banque et Bourses)', commune: 'Cocody', latitude: 5.367413, longitude: -3.989492 },
  { nom: 'ISFPT LE TRIOMPHE (Institut Supérieur de Formation Professionnelle et Technique)', commune: 'Yopougon', latitude: 5.335428, longitude: -4.064586 },
  { nom: 'ISP-HOREB ADJAME', commune: 'Adjamé', latitude: 5.36093, longitude: -4.014398 },
  { nom: 'IST RACINE', commune: 'Plateau', latitude: 5.319008, longitude: -4.01526 },
  { nom: 'IST SAINTE THERESE KOUMASSI ABIDJAN', commune: 'Koumassi', latitude: 5.285201, longitude: -3.952733 },
  { nom: 'ISTAM', commune: 'Cocody', latitude: 5.355428, longitude: -3.994067 },
  { nom: 'ISTG PIERRE MARIE YOPOUGON', commune: 'Yopougon', latitude: 5.328192, longitude: -4.072231 },
  { nom: 'ISTT YOPOUGON', commune: 'Yopougon', latitude: 5.331993, longitude: -4.074464 },
  { nom: 'IT ACADEMY ABIDJAN (INTERNATIONAL TECHNOLOGY ACADEMY)', commune: 'Cocody', latitude: 5.355326, longitude: -3.988373 },
  { nom: 'ITP CERIN DOKUI', commune: 'Abobo', latitude: 5.417222, longitude: -4.014385 },
  { nom: 'IUPA INSTITUT UNIVERSITAIRE POLYTECHNIQUE D\'ABIDJAN COCODY', commune: 'Cocody', latitude: 5.352658, longitude: -4.004885 },
  { nom: 'Institut International de Formation en Gestion et en Technologie (2IFGT) Cocody', commune: 'Cocody', latitude: 5.357423, longitude: -3.98514 },
  { nom: 'International English and Business School (IEBS)', commune: 'Cocody', latitude: 5.355832, longitude: -3.985037 },
  { nom: 'LEGACY INSTITUTE -(LEGACY)', commune: 'Abobo', latitude: 5.418361, longitude: -4.022596 },
  { nom: 'MANAGEMENT INFORMATIQUE SPORT ET ART', commune: 'Cocody', latitude: 5.363765, longitude: -3.995002 },
  { nom: 'MERITT BUSINESS SCHOOL -(MBS)', commune: 'Yopougon', latitude: 5.333317, longitude: -4.073359 },
  { nom: 'NBA BUSINESS SCHOOL -(NBS SARL)', commune: 'Cocody', latitude: 5.351687, longitude: -4.000845 },
  { nom: 'OLIGONE BUSINESS SCHOOL (OBS)', commune: 'Cocody', latitude: 5.349277, longitude: -4.001406 },
  { nom: 'PIGIER COTE D\'IVOIRE PLATEAU -(PIGIER CI PLATEAU)', commune: 'Plateau', latitude: 5.324348, longitude: -4.015 },
  { nom: 'PROMOTRAN ISF -(PISF)', commune: 'Cocody', latitude: 5.347123, longitude: -3.989458 },
  { nom: 'STRATEGIC MANAGEMENT AND INNOVATION TECHNOLOGIES INSTITUTE (SITIM)', commune: 'Cocody', latitude: 5.36319, longitude: -3.997236 },
  { nom: 'SUP\'BARAKAT -(SUP\'BARAKAT)', commune: 'Yopougon', latitude: 5.338073, longitude: -4.0741 },
  { nom: 'SUP\'ELITE BUSINESS SCHOOL -(SUP\'ELITE)', commune: 'Cocody', latitude: 5.357573, longitude: -3.988893 },
  { nom: 'SUP\'INTER YOPOUGON -(SUP\'INTER YOPOUGON)', commune: 'Yopougon', latitude: 5.338259, longitude: -4.068332 },
  { nom: 'TLM BUSINESS SCHOOL', commune: 'Plateau', latitude: 5.330307, longitude: -4.019722 },
  { nom: 'UNIVERSITE CHARLES-LOUIS DE MONTESQUIEU COCODY_GRANDE ECOLE -(UCLM COCODY_GRANDE ECOLE)', commune: 'Cocody', latitude: 5.364416, longitude: -3.99972 },
  { nom: 'UNIVERSITE INTERNATIONALE AL-MOUSTAPHA DE COTE D\'IVOIRE (UIAMCI)', commune: 'Cocody', latitude: 5.361594, longitude: -3.990901 },
  { nom: 'UNIVERSITE INTERNATIONALE DE COCODY_GRANDE ECOLE -(UIC_GRANDE ECOLE)', commune: 'Cocody', latitude: 5.361931, longitude: -3.986604 },
  // Ajoutee a la demande de Yvon, absente du fichier source (uni.txt) et
  // introuvable sur OpenStreetMap -- commune non connue, "Cocody" choisie par
  // defaut (majorite des etablissements similaires du fichier source s'y
  // trouvent), meme methode de position aleatoire que le reste du bloc.
  { nom: "Université Internationale de Côte d'Ivoire (UICI)", commune: 'Cocody', latitude: 5.34985, longitude: -3.993361 },
  { nom: 'UNIVERSITE POLYTECHNIQUE MODERNE MONA (UPM MONA)', commune: 'Cocody', latitude: 5.35171, longitude: -3.993165 },
  { nom: 'Université Internationale des Sciences Appliquées et de Technologies - UNISAT (BTS)', commune: 'Cocody', latitude: 5.347461, longitude: -3.994386 },
  { nom: 'VERACES RICHTER COLLEGE (VRC)', commune: 'Cocody', latitude: 5.346628, longitude: -3.997675 },
];

interface PoiSeed {
  nom: string;
  type: string;
  latitude: number;
  longitude: number;
}

interface QuartierSeed {
  nom: string;
  pois: PoiSeed[];
}

// Les 13 communes reelles d'Abidjan (+ Angré, quartier de Cocody garde a part
// pour compatibilite avec des donnees existantes), avec plusieurs quartiers
// et plusieurs points d'interet varies (carrefour, marche, gare, eglise,
// pharmacie, ecole...) par quartier -- jeu de donnees elargi pour couvrir
// des tests manuels varies et donner assez de choix a la demo (au depart le
// seed n'avait que quelques communes avec 1 seul POI par quartier).
const COMMUNES_DATA: Record<string, QuartierSeed[]> = {
  Yopougon: [
    {
      nom: 'Yopougon Selmer',
      pois: [
        { nom: 'Gare de Yopougon', type: 'gare', latitude: 5.3452, longitude: -4.0728 },
        { nom: 'Église Selmer', type: 'eglise', latitude: 5.3461, longitude: -4.0712 },
      ],
    },
    {
      nom: 'Yopougon Niangon',
      pois: [
        { nom: 'Carrefour Niangon', type: 'carrefour', latitude: 5.3395, longitude: -4.0891 },
        { nom: 'Pharmacie Niangon', type: 'pharmacie', latitude: 5.3402, longitude: -4.0875 },
      ],
    },
    {
      nom: 'Yopougon Sideci',
      pois: [
        { nom: 'Marché Sideci', type: 'marche', latitude: 5.3312, longitude: -4.0655 },
        { nom: 'Carrefour Sideci', type: 'carrefour', latitude: 5.332, longitude: -4.0641 },
      ],
    },
    {
      nom: 'Yopougon Toits Rouges',
      pois: [
        { nom: 'Carrefour Toits Rouges', type: 'carrefour', latitude: 5.3268, longitude: -4.0603 },
        { nom: 'École Toits Rouges', type: 'ecole', latitude: 5.3275, longitude: -4.0589 },
      ],
    },
    {
      nom: 'Yopougon Andokoi',
      pois: [
        { nom: 'Carrefour Andokoi', type: 'carrefour', latitude: 5.3521, longitude: -4.0812 },
        { nom: 'Marché Andokoi', type: 'marche', latitude: 5.3534, longitude: -4.0798 },
      ],
    },
  ],
  Abobo: [
    {
      nom: 'Abobo Avocatier',
      pois: [
        { nom: 'Carrefour Abobo', type: 'carrefour', latitude: 5.4167, longitude: -4.0167 },
        { nom: 'Pharmacie Avocatier', type: 'pharmacie', latitude: 5.4174, longitude: -4.0153 },
      ],
    },
    {
      nom: 'Abobo Baoulé',
      pois: [
        { nom: 'Gare Abobo Baoulé', type: 'gare', latitude: 5.4256, longitude: -4.0203 },
        { nom: 'Église Baoulé', type: 'eglise', latitude: 5.4263, longitude: -4.0189 },
      ],
    },
    {
      nom: 'Abobo Anonkoua-Kouté',
      pois: [
        { nom: 'Marché Anonkoua-Kouté', type: 'marche', latitude: 5.4389, longitude: -4.0089 },
        { nom: 'Carrefour Anonkoua-Kouté', type: 'carrefour', latitude: 5.4396, longitude: -4.0075 },
      ],
    },
    {
      nom: 'Abobo Sagbé',
      pois: [
        { nom: 'Carrefour Sagbé', type: 'carrefour', latitude: 5.4298, longitude: -4.0245 },
        { nom: 'École Sagbé', type: 'ecole', latitude: 5.4305, longitude: -4.0231 },
      ],
    },
    {
      nom: 'Abobo Dokui',
      pois: [
        { nom: 'Carrefour Dokui', type: 'carrefour', latitude: 5.4432, longitude: -4.0312 },
        { nom: 'Hôpital Dokui', type: 'hopital', latitude: 5.444, longitude: -4.0298 },
      ],
    },
  ],
  Marcory: [
    {
      nom: 'Marcory Résidentiel',
      pois: [
        { nom: 'Marché de Marcory', type: 'marche', latitude: 5.2926, longitude: -3.9908 },
        { nom: 'Pharmacie Résidentiel', type: 'pharmacie', latitude: 5.2933, longitude: -3.9894 },
      ],
    },
    {
      nom: 'Marcory Zone 4',
      pois: [
        { nom: 'Carrefour Zone 4', type: 'carrefour', latitude: 5.2884, longitude: -3.9847 },
        { nom: 'Église Zone 4', type: 'eglise', latitude: 5.2891, longitude: -3.9833 },
      ],
    },
    {
      nom: 'Marcory Anoumabo',
      pois: [
        { nom: 'Gare Anoumabo', type: 'gare', latitude: 5.2967, longitude: -3.9779 },
        { nom: 'Carrefour Anoumabo', type: 'carrefour', latitude: 5.2974, longitude: -3.9765 },
      ],
    },
    {
      nom: 'Marcory Biétry',
      pois: [
        { nom: 'Carrefour Biétry', type: 'carrefour', latitude: 5.2856, longitude: -3.9756 },
        { nom: 'École Biétry', type: 'ecole', latitude: 5.2863, longitude: -3.9742 },
      ],
    },
  ],
  Angré: [
    {
      nom: 'Angré 8e Tranche',
      pois: [
        { nom: 'Carrefour Angré', type: 'carrefour', latitude: 5.3789, longitude: -3.9631 },
        { nom: 'Pharmacie Angré', type: 'pharmacie', latitude: 5.3796, longitude: -3.9617 },
      ],
    },
    {
      nom: 'Angré Château',
      pois: [
        { nom: 'Carrefour Château', type: 'carrefour', latitude: 5.3845, longitude: -3.9584 },
        { nom: 'Marché Château', type: 'marche', latitude: 5.3852, longitude: -3.957 },
      ],
    },
    {
      nom: 'Angré Star',
      pois: [
        { nom: 'Carrefour Star', type: 'carrefour', latitude: 5.3812, longitude: -3.9608 },
        { nom: 'Église Angré Star', type: 'eglise', latitude: 5.3819, longitude: -3.9594 },
      ],
    },
  ],
  Cocody: [
    {
      nom: 'Cocody Danga',
      pois: [
        { nom: 'Carrefour Cocody', type: 'carrefour', latitude: 5.3484, longitude: -3.9857 },
        { nom: 'Pharmacie Danga', type: 'pharmacie', latitude: 5.3491, longitude: -3.9843 },
      ],
    },
    {
      nom: 'Cocody Riviera',
      pois: [
        { nom: 'Carrefour Riviera', type: 'carrefour', latitude: 5.3612, longitude: -3.9701 },
        { nom: 'Église Riviera', type: 'eglise', latitude: 5.3619, longitude: -3.9687 },
      ],
    },
    {
      nom: 'Cocody II Plateaux',
      pois: [
        { nom: 'Carrefour II Plateaux', type: 'carrefour', latitude: 5.3667, longitude: -3.9989 },
        { nom: 'Marché II Plateaux', type: 'marche', latitude: 5.3674, longitude: -3.9975 },
      ],
    },
    {
      nom: 'Cocody Attoban',
      pois: [
        { nom: 'Carrefour Attoban', type: 'carrefour', latitude: 5.3556, longitude: -3.9812 },
        { nom: 'École Attoban', type: 'ecole', latitude: 5.3563, longitude: -3.9798 },
      ],
    },
    {
      nom: 'Cocody Mermoz',
      pois: [
        { nom: 'Carrefour Mermoz', type: 'carrefour', latitude: 5.3378, longitude: -3.9756 },
        { nom: 'Hôpital Mermoz', type: 'hopital', latitude: 5.3385, longitude: -3.9742 },
      ],
    },
  ],
  Adjamé: [
    {
      nom: 'Adjamé Liberté',
      pois: [
        { nom: "Gare d'Adjamé", type: 'gare', latitude: 5.3489, longitude: -4.0247 },
        { nom: 'Carrefour Liberté', type: 'carrefour', latitude: 5.3496, longitude: -4.0233 },
      ],
    },
    {
      nom: 'Adjamé Bracodi',
      pois: [
        { nom: 'Marché Bracodi', type: 'marche', latitude: 5.3556, longitude: -4.0189 },
        { nom: 'Pharmacie Bracodi', type: 'pharmacie', latitude: 5.3563, longitude: -4.0175 },
      ],
    },
    {
      nom: 'Adjamé 220 Logements',
      pois: [
        { nom: 'Carrefour 220 Logements', type: 'carrefour', latitude: 5.3612, longitude: -4.0298 },
        { nom: 'École 220 Logements', type: 'ecole', latitude: 5.3619, longitude: -4.0284 },
      ],
    },
    {
      nom: 'Adjamé Williamsville',
      pois: [
        { nom: 'Carrefour Williamsville', type: 'carrefour', latitude: 5.3423, longitude: -4.0212 },
        { nom: 'Église Williamsville', type: 'eglise', latitude: 5.343, longitude: -4.0198 },
      ],
    },
  ],
  Attécoubé: [
    {
      nom: 'Attécoubé Locodjro',
      pois: [
        { nom: 'Carrefour Locodjro', type: 'carrefour', latitude: 5.3378, longitude: -4.0356 },
        { nom: 'Marché Locodjro', type: 'marche', latitude: 5.3385, longitude: -4.0342 },
      ],
    },
    {
      nom: 'Attécoubé Santé',
      pois: [
        { nom: 'Marché Santé', type: 'marche', latitude: 5.3301, longitude: -4.0298 },
        { nom: 'Pharmacie Santé', type: 'pharmacie', latitude: 5.3308, longitude: -4.0284 },
      ],
    },
    {
      nom: 'Attécoubé Abobo-Doumé',
      pois: [
        { nom: 'Carrefour Abobo-Doumé', type: 'carrefour', latitude: 5.3423, longitude: -4.0389 },
        { nom: 'École Abobo-Doumé', type: 'ecole', latitude: 5.343, longitude: -4.0375 },
      ],
    },
  ],
  Koumassi: [
    {
      nom: 'Koumassi Grand Marché',
      pois: [
        { nom: 'Grand Marché de Koumassi', type: 'marche', latitude: 5.2889, longitude: -3.9456 },
        { nom: 'Pharmacie Grand Marché', type: 'pharmacie', latitude: 5.2896, longitude: -3.9442 },
      ],
    },
    {
      nom: 'Koumassi Remblais',
      pois: [
        { nom: 'Carrefour Remblais', type: 'carrefour', latitude: 5.2945, longitude: -3.9512 },
        { nom: 'Église Remblais', type: 'eglise', latitude: 5.2952, longitude: -3.9498 },
      ],
    },
    {
      nom: 'Koumassi Sicogi',
      pois: [
        { nom: 'Carrefour Sicogi Koumassi', type: 'carrefour', latitude: 5.2867, longitude: -3.9523 },
        { nom: 'École Sicogi Koumassi', type: 'ecole', latitude: 5.2874, longitude: -3.9509 },
      ],
    },
  ],
  Plateau: [
    {
      nom: 'Plateau Centre',
      pois: [
        { nom: 'Gare du Plateau', type: 'gare', latitude: 5.3197, longitude: -4.0217 },
        { nom: 'Pharmacie du Plateau', type: 'pharmacie', latitude: 5.3204, longitude: -4.0203 },
      ],
    },
    {
      nom: 'Plateau Cité Administrative',
      pois: [
        { nom: 'Carrefour Cité Administrative', type: 'carrefour', latitude: 5.3245, longitude: -4.0156 },
        { nom: 'Église du Plateau', type: 'eglise', latitude: 5.3252, longitude: -4.0142 },
      ],
    },
    {
      nom: 'Plateau Vallon',
      pois: [
        { nom: 'Carrefour Vallon', type: 'carrefour', latitude: 5.3156, longitude: -4.0189 },
        { nom: 'Hôpital du Plateau', type: 'hopital', latitude: 5.3163, longitude: -4.0175 },
      ],
    },
  ],
  'Port-Bouët': [
    {
      nom: 'Port-Bouët Vridi',
      pois: [
        { nom: 'Carrefour Vridi', type: 'carrefour', latitude: 5.2611, longitude: -3.9756 },
        { nom: 'Marché Vridi', type: 'marche', latitude: 5.2618, longitude: -3.9742 },
      ],
    },
    {
      nom: 'Port-Bouët Gonzagueville',
      pois: [
        { nom: 'Marché Gonzagueville', type: 'marche', latitude: 5.2456, longitude: -3.9612 },
        { nom: 'École Gonzagueville', type: 'ecole', latitude: 5.2463, longitude: -3.9598 },
      ],
    },
    {
      nom: 'Port-Bouët Aéroport',
      pois: [
        { nom: 'Carrefour Aéroport', type: 'carrefour', latitude: 5.2556, longitude: -3.9267 },
        { nom: 'Pharmacie Aéroport', type: 'pharmacie', latitude: 5.2563, longitude: -3.9253 },
      ],
    },
  ],
  Treichville: [
    {
      nom: 'Treichville Zone 3',
      pois: [
        { nom: 'Gare de Treichville', type: 'gare', latitude: 5.301, longitude: -4.0142 },
        { nom: 'Carrefour Zone 3', type: 'carrefour', latitude: 5.3017, longitude: -4.0128 },
      ],
    },
    {
      nom: 'Treichville Belleville',
      pois: [
        { nom: 'Marché Belleville', type: 'marche', latitude: 5.2967, longitude: -4.0089 },
        { nom: 'Église Belleville', type: 'eglise', latitude: 5.2974, longitude: -4.0075 },
      ],
    },
    {
      nom: 'Treichville Arras',
      pois: [
        { nom: 'Carrefour Arras', type: 'carrefour', latitude: 5.2934, longitude: -4.0167 },
        { nom: 'Pharmacie Arras', type: 'pharmacie', latitude: 5.2941, longitude: -4.0153 },
      ],
    },
  ],
  Bingerville: [
    {
      nom: 'Bingerville Centre',
      pois: [
        { nom: 'Gare de Bingerville', type: 'gare', latitude: 5.3556, longitude: -3.8889 },
        { nom: 'Marché de Bingerville', type: 'marche', latitude: 5.3563, longitude: -3.8875 },
      ],
    },
    {
      nom: 'Bingerville École Normale',
      pois: [
        { nom: 'Carrefour École Normale', type: 'carrefour', latitude: 5.3489, longitude: -3.8956 },
        { nom: 'École Normale de Bingerville', type: 'ecole', latitude: 5.3496, longitude: -3.8942 },
      ],
    },
  ],
  Songon: [
    {
      nom: 'Songon Centre',
      pois: [
        { nom: 'Carrefour Songon', type: 'carrefour', latitude: 5.3167, longitude: -4.2167 },
        { nom: 'Marché de Songon', type: 'marche', latitude: 5.3174, longitude: -4.2153 },
      ],
    },
    {
      nom: 'Songon Kassemblé',
      pois: [
        { nom: 'Carrefour Kassemblé', type: 'carrefour', latitude: 5.3245, longitude: -4.2089 },
        { nom: 'École Kassemblé', type: 'ecole', latitude: 5.3252, longitude: -4.2075 },
      ],
    },
  ],
  Anyama: [
    {
      nom: 'Anyama Centre',
      pois: [
        { nom: "Gare d'Anyama", type: 'gare', latitude: 5.4956, longitude: -4.0511 },
        { nom: "Marché d'Anyama", type: 'marche', latitude: 5.4963, longitude: -4.0497 },
      ],
    },
    {
      nom: 'Anyama Akromiabla',
      pois: [
        { nom: 'Carrefour Akromiabla', type: 'carrefour', latitude: 5.5023, longitude: -4.0456 },
        { nom: 'Pharmacie Akromiabla', type: 'pharmacie', latitude: 5.503, longitude: -4.0442 },
      ],
    },
  ],
};

async function seedReferentiel() {
  for (const universite of [...UNIVERSITES, ...UNIVERSITES_PRIVEES]) {
    const existe = await prisma.universite.findFirst({
      where: { nom: universite.nom },
    });
    if (!existe) {
      await prisma.universite.create({ data: universite });
      console.log(`Universite creee : ${universite.nom}`);
    }
  }

  for (const [nomCommune, quartiersSeed] of Object.entries(COMMUNES_DATA)) {
    let commune = await prisma.commune.findFirst({
      where: { nom: nomCommune },
    });
    if (!commune) {
      commune = await prisma.commune.create({
        data: { nom: nomCommune, ville: 'Abidjan' },
      });
      console.log(`Commune creee : ${nomCommune}`);
    }

    for (const { nom: nomQuartier, pois } of quartiersSeed) {
      let quartier = await prisma.quartier.findFirst({
        where: { nom: nomQuartier },
      });
      if (!quartier) {
        quartier = await prisma.quartier.create({
          data: { nom: nomQuartier, communeId: commune.id },
        });
        console.log(`Quartier cree : ${nomQuartier}`);
      }

      for (const poi of pois) {
        const poiExiste = await prisma.pointInteret.findFirst({
          where: { nom: poi.nom },
        });
        if (!poiExiste) {
          await prisma.pointInteret.create({
            data: { ...poi, quartierId: quartier.id },
          });
          console.log(`Point d'interet cree : ${poi.nom}`);
        }
      }
    }
  }
}

async function seedAdmin() {
  const passwordHash = await bcryptjs.hash(ADMIN_PASSWORD, 12);
  await prisma.utilisateur.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash, role: 'admin' },
    create: { email: ADMIN_EMAIL, passwordHash, role: 'admin' },
  });
  console.log(`Compte admin pret : ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

// Comptes etudiants de demonstration, pour visualiser l'interface avec du
// contenu varie (demande par Yvon) -- 10 paires commune de depart ->
// universite de destination, couvrant les 10 communes reelles les plus
// utilisees, alternant trajets deja confirmes et demandes encore en cours de
// regroupement, avec des etats varies (place restantes, complet, quota
// atteint) pour voir les differents badges de l'interface. Idempotent comme
// le reste du seed : identifie chaque compte par son telephone, ne recree
// rien qui existe deja.
interface DemoUser {
  telephone: string;
  nom: string;
  prenom: string;
  conducteur: boolean;
}

const DEMO_USERS: DemoUser[] = [
  // Conducteurs (un par trajet demo).
  { telephone: '+2250700000101', nom: 'Yao', prenom: 'Marc', conducteur: true },
  { telephone: '+2250700000102', nom: 'Coulibaly', prenom: 'Ibrahim', conducteur: true },
  { telephone: '+2250700000103', nom: 'Bamba', prenom: 'Serge', conducteur: true },
  { telephone: '+2250700000104', nom: 'Kouassi', prenom: 'Junior', conducteur: true },
  { telephone: '+2250700000105', nom: 'Assi', prenom: 'Paul', conducteur: true },
  // Createurs de demande (un par demande demo).
  { telephone: '+2250700000106', nom: 'Brou', prenom: 'Ange', conducteur: false },
  { telephone: '+2250700000107', nom: 'Kra', prenom: 'Nadège', conducteur: false },
  { telephone: '+2250700000108', nom: 'Gnahoré', prenom: 'Yves', conducteur: false },
  { telephone: '+2250700000109', nom: 'Adjoua', prenom: 'Elisabeth', conducteur: false },
  { telephone: '+2250700000110', nom: 'Diallo', prenom: 'Moussa', conducteur: false },
  // Bassin de passagers/participants. Il en faut 17 (14 reservations + 3
  // participations) car un compte ne peut appartenir qu'a UNE activite a la
  // fois (voir common/utils/activite-active.ts). Avec un bassin plus petit,
  // les memes comptes se retrouvaient dans 3 ou 4 trajets simultanes : un jury
  // qui se connecte dessus verrait un etat que l'app interdit, et serait
  // bloque a la moindre creation. Chaque compte ci-dessous n'apparait donc
  // qu'une seule fois dans DEMO_TRAJETS + DEMO_DEMANDES.
  { telephone: '+2250700000111', nom: 'Koffi', prenom: 'Aya', conducteur: false },
  { telephone: '+2250700000112', nom: 'Diabaté', prenom: 'Fatou', conducteur: false },
  { telephone: '+2250700000113', nom: "N'Guessan", prenom: 'Grace', conducteur: false },
  { telephone: '+2250700000114', nom: 'Traoré', prenom: 'Aminata', conducteur: false },
  { telephone: '+2250700000115', nom: 'Sanogo', prenom: 'Mariam', conducteur: false },
  { telephone: '+2250700000116', nom: 'Ouattara', prenom: 'Salif', conducteur: false },
  { telephone: '+2250700000117', nom: 'Aka', prenom: 'Christelle', conducteur: false },
  { telephone: '+2250700000118', nom: 'Konan', prenom: 'Eric', conducteur: false },
  { telephone: '+2250700000119', nom: 'Tanoh', prenom: 'Prisca', conducteur: false },
  { telephone: '+2250700000120', nom: 'Zadi', prenom: 'Franck', conducteur: false },
  { telephone: '+2250700000121', nom: 'Bakayoko', prenom: 'Awa', conducteur: false },
  { telephone: '+2250700000122', nom: 'Yeboua', prenom: 'Cédric', conducteur: false },
  { telephone: '+2250700000123', nom: 'Silué', prenom: 'Korotoum', conducteur: false },
  { telephone: '+2250700000124', nom: 'Ehouman', prenom: 'Landry', conducteur: false },
  { telephone: '+2250700000125', nom: 'Kacou', prenom: 'Sylvie', conducteur: false },
  { telephone: '+2250700000126', nom: 'Doumbia', prenom: 'Karim', conducteur: false },
  { telephone: '+2250700000127', nom: 'Amani', prenom: 'Ruth', conducteur: false },
];

interface DemoTrajet {
  communeDepart: string;
  universite: string;
  conducteurTel: string;
  passagersTel: string[];
  heure: Date;
  cotisation: number;
}

interface DemoDemande {
  communeDepart: string;
  universite: string;
  createurTel: string;
  participantsTel: string[]; // en plus du createur
  placesRecherchees: number;
  cotisation: number;
  heure: Date;
  quotaAtteint: boolean;
}

// Les creneaux de demonstration sont RELATIFS a l'instant du seed, jamais des
// dates absolues. Avec des dates en dur, le jeu de donnees devenait invalide
// des le lendemain : la fenetre de reservation n'accepte qu'aujourd'hui ou
// demain (voir common/utils/fenetre-reservation.ts), et les crons
// d'expiration basculent en "annule"/"expiree" tout ce dont l'heure est
// passee -- l'app se retrouvait vide. Re-lancer le seed suffit desormais a
// obtenir un jeu coherent, quel que soit le jour.
// Marge volontairement plus large que le minimum metier de 1h15 : un creneau
// cree pile a 1h15 expirerait au bout de 75 minutes, donc potentiellement en
// pleine demonstration. Avec 3 heures, un seed lance le matin tient toute la
// matinee et l'apres-midi sans qu'aucun trajet ne disparaisse sous les yeux du
// jury.
const MARGE_DEMO_MS = 3 * 60 * 60 * 1000;

function creneau(joursApres: 0 | 1, heures: number, minutes = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + joursApres);
  date.setHours(heures, minutes, 0, 0);
  // Un creneau "aujourd'hui" deja passe, ou trop proche pour rester visible
  // assez longtemps, bascule a demain -- sinon le seed creerait des trajets
  // que le cron annulerait dans la foulee. Les creneaux "demain" ne sont
  // jamais concernes : ils sont toujours a plus de 3 heures.
  if (joursApres === 0 && date.getTime() - Date.now() < MARGE_DEMO_MS) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

const DEMO_TRAJETS: DemoTrajet[] = [
  {
    communeDepart: 'Yopougon',
    universite: 'FHB Cocody',
    conducteurTel: '+2250700000101',
    passagersTel: ['+2250700000111', '+2250700000112'],
    heure: creneau(0, 7, 0),
    cotisation: 1000,
  },
  {
    communeDepart: 'Abobo',
    universite: 'Université Nangui Abrogoua',
    conducteurTel: '+2250700000102',
    passagersTel: ['+2250700000113', '+2250700000114', '+2250700000115', '+2250700000116'],
    heure: creneau(0, 12, 30),
    cotisation: 900,
  },
  {
    communeDepart: 'Marcory',
    universite: "Université Catholique de l'Afrique de l'Ouest (UCAO)",
    conducteurTel: '+2250700000103',
    passagersTel: ['+2250700000117'],
    heure: creneau(1, 17, 0),
    cotisation: 750,
  },
  {
    communeDepart: 'Adjamé',
    universite: 'ESATIC',
    conducteurTel: '+2250700000104',
    passagersTel: ['+2250700000118', '+2250700000119', '+2250700000120'],
    heure: creneau(1, 7, 30),
    cotisation: 700,
  },
  {
    communeDepart: 'Port-Bouët',
    universite: 'FHB Cocody',
    conducteurTel: '+2250700000105',
    passagersTel: ['+2250700000121', '+2250700000122', '+2250700000123', '+2250700000124'],
    heure: creneau(1, 9, 0),
    cotisation: 1100,
  },
];

const DEMO_DEMANDES: DemoDemande[] = [
  {
    communeDepart: 'Koumassi',
    universite: "Université Internationale de Côte d'Ivoire (UICI)",
    createurTel: '+2250700000106',
    participantsTel: ['+2250700000125'],
    placesRecherchees: 2,
    cotisation: 1500,
    heure: creneau(0, 8, 0),
    quotaAtteint: true,
  },
  {
    communeDepart: 'Plateau',
    universite: 'ESATIC',
    createurTel: '+2250700000107',
    participantsTel: [],
    placesRecherchees: 3,
    cotisation: 1200,
    heure: creneau(1, 12, 0),
    quotaAtteint: false,
  },
  {
    communeDepart: 'Cocody',
    universite: "Université Virtuelle de Côte d'Ivoire (UVCI)",
    createurTel: '+2250700000108',
    participantsTel: [],
    placesRecherchees: 2,
    cotisation: 1000,
    heure: creneau(1, 9, 30),
    quotaAtteint: false,
  },
  {
    communeDepart: 'Treichville',
    universite: 'Université Nangui Abrogoua',
    createurTel: '+2250700000109',
    participantsTel: ['+2250700000126', '+2250700000127'],
    placesRecherchees: 3,
    cotisation: 1300,
    heure: creneau(0, 16, 0),
    quotaAtteint: true,
  },
  {
    communeDepart: 'Attécoubé',
    universite: "Université Catholique de l'Afrique de l'Ouest (UCAO)",
    createurTel: '+2250700000110',
    participantsTel: [],
    placesRecherchees: 2,
    cotisation: 1400,
    heure: creneau(1, 18, 0),
    quotaAtteint: false,
  },
];

async function seedDemo() {
  const userIdByTel = new Map<string, string>();

  for (const u of DEMO_USERS) {
    let user = await prisma.utilisateur.findUnique({
      where: { telephone: u.telephone },
    });
    if (!user) {
      user = await prisma.utilisateur.create({
        data: {
          telephone: u.telephone,
          nom: u.nom,
          prenom: u.prenom,
          role: u.conducteur ? 'les deux' : 'etudiant',
        },
      });
      if (u.conducteur) {
        const dejaDocs = await prisma.documentsConducteur.findFirst({
          where: { userId: user.id },
        });
        if (!dejaDocs) {
          await prisma.documentsConducteur.create({
            data: {
              userId: user.id,
              selfie: 'demo-selfie.jpg',
              photoPermis: 'demo-permis.jpg',
              matriculeVehicule: `CI-DEMO-${u.telephone.slice(-3)}`,
              statut: 'valide',
            },
          });
        }
      }
      console.log(`Etudiant demo cree : ${u.prenom} ${u.nom}`);
    }
    userIdByTel.set(u.telephone, user.id);
  }

  for (const t of DEMO_TRAJETS) {
    const conducteurId = userIdByTel.get(t.conducteurTel);
    if (!conducteurId) continue;

    // Dedup par conducteur et non par heure : l'heure etant desormais
    // relative, elle differe a chaque execution et ne peut plus servir de cle.
    // "Un trajet a venir encore ouvert" suffit -- chaque conducteur demo n'en
    // a qu'un, et ceux d'hier sont passes, donc un nouveau seed les remplace.
    const dejaTrajet = await prisma.trajet.findFirst({
      where: { conducteurId, statut: 'ouvert', heure: { gt: new Date() } },
    });
    if (dejaTrajet) continue;

    const universite = await prisma.universite.findFirst({
      where: { nom: t.universite },
    });
    const poi = await prisma.pointInteret.findFirst({
      where: { quartier: { commune: { nom: t.communeDepart } } },
    });
    if (!universite || !poi) {
      console.log(`Trajet demo ignore (referentiel introuvable) : ${t.communeDepart} -> ${t.universite}`);
      continue;
    }

    const trajet = await prisma.trajet.create({
      data: {
        conducteurId,
        universiteId: universite.id,
        pointDeRdvId: poi.id,
        heure: t.heure,
        places: 4,
        cotisation: t.cotisation,
        statut: 'ouvert',
      },
    });

    for (const passagerTel of t.passagersTel) {
      const passagerId = userIdByTel.get(passagerTel);
      if (!passagerId) continue;
      await prisma.reservation.create({
        data: { trajetId: trajet.id, passagerId, prixParPersonne: t.cotisation, statut: 'confirmee' },
      });
    }
    console.log(`Trajet demo cree : ${t.communeDepart} -> ${t.universite} (${t.passagersTel.length}/4 places)`);
  }

  for (const d of DEMO_DEMANDES) {
    const createurId = userIdByTel.get(d.createurTel);
    if (!createurId) continue;

    // Meme raison que pour les trajets ci-dessus.
    const dejaDemande = await prisma.demande.findFirst({
      where: {
        createurId,
        statut: { in: ['ouverte', 'quota_atteint'] },
        heure: { gt: new Date() },
      },
    });
    if (dejaDemande) continue;

    const universite = await prisma.universite.findFirst({
      where: { nom: d.universite },
    });
    const commune = await prisma.commune.findFirst({
      where: { nom: d.communeDepart },
    });
    const poi = await prisma.pointInteret.findFirst({
      where: { quartier: { commune: { nom: d.communeDepart } } },
    });
    if (!universite || !commune || !poi) {
      console.log(`Demande demo ignoree (referentiel introuvable) : ${d.communeDepart} -> ${d.universite}`);
      continue;
    }

    const demande = await prisma.demande.create({
      data: {
        createurId,
        universiteId: universite.id,
        communeId: commune.id,
        quartierId: poi.quartierId,
        heure: d.heure,
        placesRecherchees: d.placesRecherchees,
        cotisation: d.cotisation,
        statut: d.quotaAtteint ? 'quota_atteint' : 'ouverte',
        poiId: d.quotaAtteint ? poi.id : undefined,
      },
    });

    // Position du createur = celle du POI de la commune (approximation
    // raisonnable pour de la donnee de demo, pas de vraie position GPS ici).
    await prisma.participation.create({
      data: {
        demandeId: demande.id,
        userId: createurId,
        positionLat: poi.latitude,
        positionLng: poi.longitude,
        statut: 'confirmee',
      },
    });
    for (const participantTel of d.participantsTel) {
      const participantId = userIdByTel.get(participantTel);
      if (!participantId) continue;
      await prisma.participation.create({
        data: {
          demandeId: demande.id,
          userId: participantId,
          positionLat: poi.latitude,
          positionLng: poi.longitude,
          statut: 'confirmee',
        },
      });
    }
    console.log(
      `Demande demo creee : ${d.communeDepart} -> ${d.universite} (${d.participantsTel.length + 1}/${d.placesRecherchees}${d.quotaAtteint ? ', quota atteint' : ''})`,
    );
  }
}

async function main() {
  await seedReferentiel();
  await seedAdmin();
  await seedDemo();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
