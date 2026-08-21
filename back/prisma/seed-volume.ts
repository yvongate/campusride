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

// Nombre d'offres (trajets + demandes) generees par universite.
export const OFFRES_PAR_UNIVERSITE = 12;

// Combien d'universites recoivent ce jeu de donnees. 432 = toutes celles du
// referentiel (6 publiques + 426 privees) : quelle que soit l'ecole choisie
// par la personne qui teste l'app, elle y trouve de l'offre plutot qu'un
// ecran vide.
//
// Ordre de grandeur, mesure : ~5 200 offres, ~12 300 comptes, ~30 000 lignes,
// ~47 000 requetes. Soit environ 90 secondes depuis le Shell de Render, mais
// pres d'une heure depuis un poste distant (la latence reseau domine) --
// lancer le seed depuis Render, donc.
//
// La regle "une seule activite active par compte"
// (common/utils/activite-active.ts) interdit de reutiliser les personnes :
// c'est elle qui impose autant de comptes. Ce volume a aussi rendu la
// pagination SERVEUR obligatoire sur la liste des comptes du back-office
// (UsersService.listerComptes), qui renvoyait jusqu'ici toute la table.
export const NB_UNIVERSITES_DEMO = 432;

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
  return `+2250700${String(100000 + index)}`;
}

async function compteDemo(
  prisma: PrismaClient,
  index: number,
  conducteur: boolean,
): Promise<string> {
  const telephone = telephoneDemo(index);
  const existant = await prisma.utilisateur.findUnique({ where: { telephone } });
  if (existant) {
    return existant.id;
  }

  const user = await prisma.utilisateur.create({
    data: {
      telephone,
      nom: NOMS[index % NOMS.length],
      prenom: PRENOMS[(index * 7) % PRENOMS.length],
      role: conducteur ? 'les deux' : 'etudiant',
    },
  });

  if (conducteur) {
    // Sans dossier valide, le conducteur n'apparaitrait pas comme verifie et
    // les cards de trajet perdraient leur badge -- exactement l'element de
    // confiance que la demo doit montrer.
    await prisma.documentsConducteur.create({
      data: {
        userId: user.id,
        selfie: 'demo-selfie.jpg',
        photoPermis: 'demo-permis.jpg',
        matriculeVehicule: `CI-DEMO-${String(index).padStart(4, '0')}`,
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

  let trajetsCrees = 0;
  let demandesCreees = 0;

  for (const [indexUniv, universite] of universites.entries()) {
    const alea = creerAleatoire(indexUniv + 1);

    for (let i = 0; i < OFFRES_PAR_UNIVERSITE; i++) {
      // Bloc de 6 identifiants reserve a cette offre : 1 proprietaire et
      // jusqu'a 5 accompagnants. Deterministe, donc re-executable.
      const base = (indexUniv * OFFRES_PAR_UNIVERSITE + i) * 6;

      const commune = utilisables[Math.floor(alea() * utilisables.length)];
      const poi = commune.pois[Math.floor(alea() * commune.pois.length)];
      // Environ un tiers aujourd'hui, le reste demain (creneau() reporte de
      // lui-meme au lendemain ce qui serait trop proche pour tenir).
      const heure = creneau(
        alea() < 0.35 ? 0 : 1,
        6 + Math.floor(alea() * 13),
        alea() < 0.5 ? 0 : 30,
      );
      const cotisation = 500 + Math.floor(alea() * 31) * 50;
      const places = 2 + Math.floor(alea() * 3);
      // Remplissage varie : certaines offres complètes (pour montrer le badge
      // correspondant), d'autres encore ouvertes.
      const accompagnants = Math.floor(alea() * (places + 1));

      if (i % 2 === 0) {
        const conducteurId = await compteDemo(prisma, base, true);
        const deja = await prisma.trajet.findFirst({
          where: {
            conducteurId,
            statut: 'ouvert',
            heure: { gt: new Date() },
          },
        });
        if (deja) continue;

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

        for (let p = 0; p < Math.min(accompagnants, places); p++) {
          const passagerId = await compteDemo(prisma, base + 1 + p, false);
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
      } else {
        const createurId = await compteDemo(prisma, base, false);
        const deja = await prisma.demande.findFirst({
          where: {
            createurId,
            statut: { in: ['ouverte', 'quota_atteint'] },
            heure: { gt: new Date() },
          },
        });
        if (deja) continue;

        // Le createur compte dans le quota : au plus places-1 accompagnants.
        const participants = Math.min(accompagnants, places - 1);
        const quotaAtteint = participants + 1 >= places;

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
          const participantId = await compteDemo(prisma, base + 1 + p, false);
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

  console.log(
    `Seed volume : ${trajetsCrees} trajets et ${demandesCreees} demandes sur ${universites.length} universites.`,
  );
}
