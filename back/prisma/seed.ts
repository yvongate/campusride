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

// Coordonnees approximatives (usage demo uniquement, pas de precision
// geodesique attendue) -- mêmes noms que UI_inspo/CampusRide App.dc.html
// pour que la demo corresponde aux maquettes montrees au jury.
const UNIVERSITES = [
  { nom: 'FHB Cocody', commune: 'Cocody', latitude: 5.3437, longitude: -3.9868 },
  { nom: 'INP-HB', commune: 'Yamoussoukro', latitude: 6.9167, longitude: -5.2167 },
  {
    nom: 'Université Nangui Abrogoua',
    commune: 'Abobo',
    latitude: 5.4149,
    longitude: -4.0301,
  },
  { nom: 'ESATIC', commune: 'Treichville', latitude: 5.301, longitude: -4.0142 },
  {
    nom: "Université Catholique de l'Afrique de l'Ouest",
    commune: 'Cocody',
    latitude: 5.336,
    longitude: -3.985,
  },
];

interface QuartierSeed {
  nom: string;
  poi: { nom: string; type: string; latitude: number; longitude: number };
}

// Les 13 communes reelles d'Abidjan, avec plusieurs quartiers/POI chacune --
// jeu de donnees elargi pour couvrir des tests manuels varies (au depart le
// seed n'avait que 5 communes et 1 quartier/POI chacune). "Angré" est en
// realite un quartier de Cocody, pas une commune a part entiere, mais reste
// ici tel quel (idempotent, deja utilise par des donnees existantes).
const COMMUNES_DATA: Record<string, QuartierSeed[]> = {
  Yopougon: [
    { nom: 'Yopougon Selmer', poi: { nom: 'Gare de Yopougon', type: 'gare', latitude: 5.3452, longitude: -4.0728 } },
    { nom: 'Yopougon Niangon', poi: { nom: 'Carrefour Niangon', type: 'carrefour', latitude: 5.3395, longitude: -4.0891 } },
    { nom: 'Yopougon Sideci', poi: { nom: 'Marché Sideci', type: 'marche', latitude: 5.3312, longitude: -4.0655 } },
  ],
  Abobo: [
    { nom: 'Abobo Avocatier', poi: { nom: 'Carrefour Abobo', type: 'carrefour', latitude: 5.4167, longitude: -4.0167 } },
    { nom: 'Abobo Baoulé', poi: { nom: 'Gare Abobo Baoulé', type: 'gare', latitude: 5.4256, longitude: -4.0203 } },
    { nom: 'Abobo Anonkoua-Kouté', poi: { nom: 'Marché Anonkoua-Kouté', type: 'marche', latitude: 5.4389, longitude: -4.0089 } },
  ],
  Marcory: [
    { nom: 'Marcory Résidentiel', poi: { nom: 'Marché de Marcory', type: 'marche', latitude: 5.2926, longitude: -3.9908 } },
    { nom: 'Marcory Zone 4', poi: { nom: 'Carrefour Zone 4', type: 'carrefour', latitude: 5.2884, longitude: -3.9847 } },
    { nom: 'Marcory Anoumabo', poi: { nom: 'Gare Anoumabo', type: 'gare', latitude: 5.2967, longitude: -3.9779 } },
  ],
  Angré: [
    { nom: 'Angré 8e Tranche', poi: { nom: 'Carrefour Angré', type: 'carrefour', latitude: 5.3789, longitude: -3.9631 } },
    { nom: 'Angré Château', poi: { nom: 'Carrefour Château', type: 'carrefour', latitude: 5.3845, longitude: -3.9584 } },
  ],
  Cocody: [
    { nom: 'Cocody Danga', poi: { nom: 'Carrefour Cocody', type: 'carrefour', latitude: 5.3484, longitude: -3.9857 } },
    { nom: 'Cocody Riviera', poi: { nom: 'Carrefour Riviera', type: 'carrefour', latitude: 5.3612, longitude: -3.9701 } },
    { nom: 'Cocody II Plateaux', poi: { nom: 'Carrefour II Plateaux', type: 'carrefour', latitude: 5.3667, longitude: -3.9989 } },
  ],
  Adjamé: [
    { nom: 'Adjamé Liberté', poi: { nom: "Gare d'Adjamé", type: 'gare', latitude: 5.3489, longitude: -4.0247 } },
    { nom: 'Adjamé Bracodi', poi: { nom: 'Marché Bracodi', type: 'marche', latitude: 5.3556, longitude: -4.0189 } },
  ],
  Attécoubé: [
    { nom: 'Attécoubé Locodjro', poi: { nom: 'Carrefour Locodjro', type: 'carrefour', latitude: 5.3378, longitude: -4.0356 } },
    { nom: 'Attécoubé Santé', poi: { nom: 'Marché Santé', type: 'marche', latitude: 5.3301, longitude: -4.0298 } },
  ],
  Koumassi: [
    { nom: 'Koumassi Grand Marché', poi: { nom: 'Grand Marché de Koumassi', type: 'marche', latitude: 5.2889, longitude: -3.9456 } },
    { nom: 'Koumassi Remblais', poi: { nom: 'Carrefour Remblais', type: 'carrefour', latitude: 5.2945, longitude: -3.9512 } },
  ],
  Plateau: [
    { nom: 'Plateau Centre', poi: { nom: 'Gare du Plateau', type: 'gare', latitude: 5.3197, longitude: -4.0217 } },
    { nom: 'Plateau Cité Administrative', poi: { nom: 'Carrefour Cité Administrative', type: 'carrefour', latitude: 5.3245, longitude: -4.0156 } },
  ],
  'Port-Bouët': [
    { nom: 'Port-Bouët Vridi', poi: { nom: 'Carrefour Vridi', type: 'carrefour', latitude: 5.2611, longitude: -3.9756 } },
    { nom: 'Port-Bouët Gonzagueville', poi: { nom: 'Marché Gonzagueville', type: 'marche', latitude: 5.2456, longitude: -3.9612 } },
  ],
  Treichville: [
    { nom: 'Treichville Zone 3', poi: { nom: 'Gare de Treichville', type: 'gare', latitude: 5.301, longitude: -4.0142 } },
    { nom: 'Treichville Belleville', poi: { nom: 'Marché Belleville', type: 'marche', latitude: 5.2967, longitude: -4.0089 } },
  ],
  Bingerville: [
    { nom: 'Bingerville Centre', poi: { nom: 'Gare de Bingerville', type: 'gare', latitude: 5.3556, longitude: -3.8889 } },
  ],
  Songon: [
    { nom: 'Songon Centre', poi: { nom: 'Carrefour Songon', type: 'carrefour', latitude: 5.3167, longitude: -4.2167 } },
  ],
  Anyama: [
    { nom: 'Anyama Centre', poi: { nom: "Gare d'Anyama", type: 'gare', latitude: 5.4956, longitude: -4.0511 } },
  ],
};

async function seedReferentiel() {
  for (const universite of UNIVERSITES) {
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

    for (const { nom: nomQuartier, poi } of quartiersSeed) {
      let quartier = await prisma.quartier.findFirst({
        where: { nom: nomQuartier },
      });
      if (!quartier) {
        quartier = await prisma.quartier.create({
          data: { nom: nomQuartier, communeId: commune.id },
        });
        console.log(`Quartier cree : ${nomQuartier}`);
      }

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

async function seedAdmin() {
  const passwordHash = await bcryptjs.hash(ADMIN_PASSWORD, 12);
  await prisma.utilisateur.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash, role: 'admin' },
    create: { email: ADMIN_EMAIL, passwordHash, role: 'admin' },
  });
  console.log(`Compte admin pret : ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

async function main() {
  await seedReferentiel();
  await seedAdmin();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
