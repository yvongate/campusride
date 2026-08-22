// Jeu de demonstration EN VOLUME, complementaire du jeu ecrit a la main dans
// seed.ts (qui, lui, met en scene des etats precis : trajet complet, quota
// atteint, demande sans participant...).
//
// Objectif : qu'un membre du jury qui choisit son universite y trouve
// toujours de l'offre, au lieu d'un ecran vide. On genere donc plusieurs
// offres par universite, reparties sur des communes de depart et des
// creneaux differents.
import type { PrismaClient } from '../generated/prisma/client';

// Marge volontairement plus large que le minimum metier de 1h15 : un creneau
// cree pile a 1h15 expirerait au bout de 75 minutes, donc potentiellement en
// pleine demonstration. Avec 3 heures, un seed lance le matin tient toute la
// matinee et l'apres-midi sans qu'aucun trajet ne disparaisse sous les yeux
// du jury.
const MARGE_DEMO_MS = 3 * 60 * 60 * 1000;

// Les creneaux de demonstration sont RELATIFS a l'instant du seed, jamais des
// dates absolues. Avec des dates en dur, le jeu de donnees devenait invalide
// des le lendemain : la fenetre de reservation n'accepte qu'aujourd'hui ou
// demain (voir src/common/utils/fenetre-reservation.ts), et les crons
// d'expiration basculent en "annule"/"expiree" tout ce dont l'heure est
// passee -- l'app se retrouvait vide.
export function creneau(
  joursApres: 0 | 1,
  heures: number,
  minutes = 0,
): Date {
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

// L'accueil filtre sur l'universite ET la commune de depart. Generer N offres
// par universite en tirant la commune au hasard laissait donc environ 40 % des
// couples vides -- exactement l'ecran vide qu'on cherchait a eviter. On couvre
// desormais CHAQUE couple (universite, commune) avec un trajet et une demande.
// Chaque ecole recoit ainsi 2 x 14 communes = 28 offres, bien au-dela des 12
// demandees, et aucune combinaison choisie par un utilisateur ne peut etre
// vide.
export const OFFRES_PAR_COUPLE = 2;

// Combien d'universites recoivent ce jeu de donnees. 432 = toutes celles du
// referentiel (6 publiques + 426 privees).
export const NB_UNIVERSITES_DEMO = 432;

// Prefixe des numeros generes. Sert aussi a recharger en UNE requete les
// comptes deja crees, au lieu d'un findUnique par compte.
// Plage 2xxxxx. La plage 1xxxxx a servi a une repartition anterieure, ou les
// offres etaient dispersees au hasard entre les communes : les memes numeros y
// designaient d'autres roles. Repartir sur une plage vierge evite qu'un compte
// deja conducteur d'un trajet a venir bloque la creation d'une offre, ou
// qu'un ancien passager soit resservi comme conducteur sans dossier valide.
// Les anciennes offres restent en base et expirent d'elles-memes.
const PREFIXE_TEL = '+22507002';

// Generateur pseudo-aleatoire deterministe (mulberry32). Le jeu varie d'une
// universite a l'autre, mais reste identique d'une execution a l'autre : un
// probleme constate pendant la demo reste reproductible, ce qu'un
// Math.random() ne permettrait pas.
function creerAleatoire(graine: number): () => number {
  let etat = graine >>> 0;
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = Math.imul(etat ^ (etat >>> 15), 1 | etat);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOMS = [
  'Kouassi', 'Yao', 'Koffi', 'Traoré', 'Diabaté', 'Ouattara', 'Bamba',
  'Coulibaly', 'Koné', 'Sanogo', 'Aka', 'Konan', 'Tanoh', 'Brou', 'Kra',
  'Silué', 'Doumbia', 'Amani', 'Zadi', 'Ehouman', 'Gnahoré', 'Adjoua',
  'Bakayoko', 'Yeboua', 'Kacou',
];

const PRENOMS = [
  'Aya', 'Marc', 'Fatou', 'Ibrahim', 'Grace', 'Awa', 'Serge', 'Junior',
  'Paul', 'Mariam', 'Cédric', 'Prisca', 'Landry', 'Sylvie', 'Karim', 'Ruth',
  'Franck', 'Christelle', 'Salif', 'Korotoum', 'Ange', 'Nadège', 'Yves',
  'Elisabeth', 'Moussa',
];

// Plage de numeros distincte de celle du jeu ecrit a la main
// (+2250700000101 a +2250700000127), pour qu'aucune collision ne soit
// possible. Deterministe : re-executer le seed retombe sur les memes
// comptes au lieu d'en creer de nouveaux.
function telephoneDemo(index: number): string {
  return `+2250700${String(200000 + index)}`;
}

// Cache des comptes deja crees, rempli d'UNE requete au demarrage. Sans lui,
// on ferait un findUnique par compte, soit pres de 30 000 allers-retours
// reseau inutiles.
type CacheComptes = Map<string, string>;

async function compteDemo(
  prisma: PrismaClient,
  cache: CacheComptes,
  avecDossier: Set<string>,
  index: number,
  conducteur: boolean,
): Promise<string> {
  const telephone = telephoneDemo(index);
  const connu = cache.get(telephone);
  if (connu) {
    // Un seed interrompu entre la creation du compte et celle de son dossier
    // laisserait un conducteur non verifie, donc sans badge sur les cards.
    if (conducteur && !avecDossier.has(connu)) {
      await prisma.documentsConducteur.create({
        data: {
          userId: connu,
          selfie: 'demo-selfie.jpg',
          photoPermis: 'demo-permis.jpg',
          matriculeVehicule: `CI-DEMO-${String(index).padStart(5, '0')}`,
          statut: 'valide',
        },
      });
      avecDossier.add(connu);
    }
    return connu;
  }

  const user = await prisma.utilisateur.create({
    data: {
      telephone,
      nom: NOMS[index % NOMS.length],
      prenom: PRENOMS[(index * 7) % PRENOMS.length],
      role: conducteur ? 'les deux' : 'etudiant',
    },
  });
  cache.set(telephone, user.id);

  if (conducteur) {
    avecDossier.add(user.id);
    // Sans dossier valide, le conducteur n'apparaitrait pas comme verifie et
    // les cards de trajet perdraient leur badge -- exactement l'element de
    // confiance que la demo doit montrer.
    await prisma.documentsConducteur.create({
      data: {
        userId: user.id,
        selfie: 'demo-selfie.jpg',
        photoPermis: 'demo-permis.jpg',
        matriculeVehicule: `CI-DEMO-${String(index).padStart(5, '0')}`,
        statut: 'valide',
      },
    });
  }

  return user.id;
}

interface CommuneUtilisable {
  id: string;
  nom: string;
  pois: { id: string; quartierId: string; latitude: number; longitude: number }[];
}

export async function seedDemoVolume(prisma: PrismaClient): Promise<void> {
  const universites = await prisma.universite.findMany({
    take: NB_UNIVERSITES_DEMO,
    orderBy: { createdAt: 'asc' },
  });

  // Referentiel charge UNE fois : le faire par offre multiplierait les
  // allers-retours reseau par cent sur une base distante.
  const communes = await prisma.commune.findMany({
    include: { quartiers: { include: { pointsInteret: true } } },
  });

  const utilisables: CommuneUtilisable[] = communes
    .map((c) => ({
      id: c.id,
      nom: c.nom,
      pois: c.quartiers.flatMap((q) =>
        q.pointsInteret.map((p) => ({
          id: p.id,
          quartierId: q.id,
          latitude: p.latitude,
          longitude: p.longitude,
        })),
      ),
    }))
    .filter((c) => c.pois.length > 0);

  if (universites.length === 0 || utilisables.length === 0) {
    console.log('Seed volume ignore : referentiel incomplet.');
    return;
  }

  // Trois lectures groupees remplacent des dizaines de milliers de requetes
  // unitaires : les comptes deja generes, et les proprietaires qui ont encore
  // une offre a venir (donc a ne pas resservir, sous peine de violer la regle
  // "une seule activite active par compte").
  const maintenant = new Date();
  const comptesExistants = await prisma.utilisateur.findMany({
    where: { telephone: { startsWith: PREFIXE_TEL } },
    select: { id: true, telephone: true },
  });
  const cache: CacheComptes = new Map(
    comptesExistants
      .filter((u): u is { id: string; telephone: string } => u.telephone !== null)
      .map((u) => [u.telephone, u.id]),
  );

  const avecDossier = new Set(
    (
      await prisma.documentsConducteur.findMany({
        where: { statut: 'valide' },
        select: { userId: true },
      })
    ).map((d) => d.userId),
  );

  const conducteursOccupes = new Set(
    (
      await prisma.trajet.findMany({
        where: { statut: 'ouvert', heure: { gt: maintenant } },
        select: { conducteurId: true },
      })
    ).map((t) => t.conducteurId),
  );
  const createursOccupes = new Set(
    (
      await prisma.demande.findMany({
        where: {
          statut: { in: ['ouverte', 'quota_atteint'] },
          heure: { gt: maintenant },
        },
        select: { createurId: true },
      })
    ).map((d) => d.createurId),
  );

  let trajetsCrees = 0;
  let demandesCreees = 0;

  for (const [indexUniv, universite] of universites.entries()) {
    for (const [indexCommune, commune] of utilisables.entries()) {
      // Graine propre au couple : deux ecoles n'ont pas les memes horaires ni
      // les memes prix, mais le jeu reste identique d'une execution a l'autre.
      const alea = creerAleatoire(indexUniv * 1000 + indexCommune + 1);

      // Bloc de 12 identifiants reserve a ce couple : 6 pour le trajet
      // (conducteur + 5 places au plus), 6 pour la demande. Calcule et non
      // incremente, pour rester aligne meme quand une offre est sautee.
      const base = (indexUniv * utilisables.length + indexCommune) * 12;

      // --- Trajet ---
      {
        const poi = commune.pois[Math.floor(alea() * commune.pois.length)];
        const heure = creneau(
          alea() < 0.35 ? 0 : 1,
          6 + Math.floor(alea() * 13),
          alea() < 0.5 ? 0 : 30,
        );
        const cotisation = 500 + Math.floor(alea() * 31) * 50;
        const places = 2 + Math.floor(alea() * 3);
        const passagers = Math.floor(alea() * (places + 1));

        const conducteurId = await compteDemo(prisma, cache, avecDossier, base, true);
        if (!conducteursOccupes.has(conducteurId)) {
          const trajet = await prisma.trajet.create({
            data: {
              conducteurId,
              universiteId: universite.id,
              pointDeRdvId: poi.id,
              heure,
              places,
              cotisation,
              statut: 'ouvert',
            },
          });
          conducteursOccupes.add(conducteurId);

          for (let p = 0; p < Math.min(passagers, places); p++) {
            const passagerId = await compteDemo(prisma, cache, avecDossier, base + 1 + p, false);
            await prisma.reservation.create({
              data: {
                trajetId: trajet.id,
                passagerId,
                prixParPersonne: cotisation,
                statut: 'confirmee',
              },
            });
          }
          trajetsCrees += 1;
        }
      }

      // --- Demande ---
      {
        const poi = commune.pois[Math.floor(alea() * commune.pois.length)];
        const heure = creneau(
          alea() < 0.35 ? 0 : 1,
          6 + Math.floor(alea() * 13),
          alea() < 0.5 ? 0 : 30,
        );
        const cotisation = 500 + Math.floor(alea() * 31) * 50;
        const places = 2 + Math.floor(alea() * 3);
        // Le createur compte dans le quota : au plus places-1 accompagnants.
        const participants = Math.min(
          Math.floor(alea() * places),
          places - 1,
        );
        const quotaAtteint = participants + 1 >= places;

        const createurId = await compteDemo(prisma, cache, avecDossier, base + 6, false);
        if (!createursOccupes.has(createurId)) {
          const demande = await prisma.demande.create({
            data: {
              createurId,
              universiteId: universite.id,
              communeId: commune.id,
              quartierId: poi.quartierId,
              heure,
              placesRecherchees: places,
              cotisation,
              statut: quotaAtteint ? 'quota_atteint' : 'ouverte',
              poiId: quotaAtteint ? poi.id : undefined,
            },
          });
          createursOccupes.add(createurId);

          await prisma.participation.create({
            data: {
              demandeId: demande.id,
              userId: createurId,
              positionLat: poi.latitude,
              positionLng: poi.longitude,
              statut: 'confirmee',
            },
          });

          for (let p = 0; p < participants; p++) {
            const participantId = await compteDemo(
              prisma,
              cache,
              avecDossier,
              base + 7 + p,
              false,
            );
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
          demandesCreees += 1;
        }
      }
    }
  }

  console.log(
    `Seed volume : ${trajetsCrees} trajets et ${demandesCreees} demandes, ` +
      `${universites.length} universites x ${utilisables.length} communes.`,
  );
}
