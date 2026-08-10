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
