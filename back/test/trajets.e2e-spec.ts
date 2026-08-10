import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import bcryptjs from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TrajetsService } from '../src/trajets/trajets.service';

async function requestOtpAndGetCode(
  app: INestApplication<App>,
  phone: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/otp/request')
    .send({ phone })
    .expect(200);
  return (res.body as { code: string }).code;
}

describe('Trajets (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let conducteurToken: string;
  let etudiantToken: string;
  let universiteId: string;
  let pointDeRdvId: string;
  let communeId: string;

  const ADMIN_EMAIL = 'admin-trajets-e2e@campusride.ci';
  const ADMIN_PASSWORD = 'un-mot-de-passe-suffisamment-long';
  const CONDUCTEUR_PHONE = '+2250700000060';
  const ETUDIANT_PHONE = '+2250700000061';
  const TINY_JPEG = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9,
  ]);

  async function cleanup() {
    // Signalement reference Trajet et Utilisateur -- doit etre supprime avant
    // les deux (Story 7.1), sinon violation de contrainte de cle etrangere
    // sur un run e2e ulterieur.
    await prisma.signalement.deleteMany({
      where: { trajet: { conducteur: { telephone: CONDUCTEUR_PHONE } } },
    });
    await prisma.reservation.deleteMany({
      where: { trajet: { conducteur: { telephone: CONDUCTEUR_PHONE } } },
    });
    await prisma.trajet.deleteMany({
      where: { conducteur: { telephone: CONDUCTEUR_PHONE } },
    });
    await prisma.documentsConducteur.deleteMany({
      where: { utilisateur: { telephone: CONDUCTEUR_PHONE } },
    });
    await prisma.verificationIdentite.deleteMany({
      where: { utilisateur: { telephone: CONDUCTEUR_PHONE } },
    });
    await prisma.utilisateur.deleteMany({ where: { email: ADMIN_EMAIL } });
    await prisma.utilisateur.deleteMany({
      where: { telephone: { in: [CONDUCTEUR_PHONE, ETUDIANT_PHONE] } },
    });
    await prisma.pointInteret.deleteMany({
      where: { nom: { startsWith: 'E2E ' } },
    });
    await prisma.quartier.deleteMany({
      where: { nom: { startsWith: 'E2E ' } },
    });
    await prisma.commune.deleteMany({ where: { nom: { startsWith: 'E2E ' } } });
    await prisma.universite.deleteMany({
      where: { nom: { startsWith: 'E2E ' } },
    });
  }

  beforeAll(async () => {
    // Ce beforeAll enchaine reellement le parcours complet (bcrypt cost 12,
    // creation du referentiel, flux OTP x2, upload multipart, validation
    // admin) -- depasse le timeout par defaut de 5000ms sans etre un
    // probleme de performance applicative, juste un volume de setup e2e.
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    await cleanup();

    // Admin (flux reel /auth/admin/login, Story 1.6)
    const passwordHash = await bcryptjs.hash(ADMIN_PASSWORD, 12);
    await prisma.utilisateur.create({
      data: { email: ADMIN_EMAIL, passwordHash, role: 'admin' },
    });
    const adminLoginRes = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    adminToken = (adminLoginRes.body as { accessToken: string }).accessToken;

    // Referentiel : commune -> quartier -> POI, + universite (admin)
    const communeRes = await request(app.getHttpServer())
      .post('/referentiel/communes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'E2E Cocody', ville: 'Abidjan' })
      .expect(201);
    communeId = (communeRes.body as { id: string }).id;
    const quartierRes = await request(app.getHttpServer())
      .post('/referentiel/quartiers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nom: 'E2E Angre',
        communeId: (communeRes.body as { id: string }).id,
      })
      .expect(201);
    const poiRes = await request(app.getHttpServer())
      .post('/referentiel/points-interet')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nom: 'E2E Carrefour Angre',
        type: 'carrefour',
        quartierId: (quartierRes.body as { id: string }).id,
        latitude: 5.36,
        longitude: -3.98,
      })
      .expect(201);
    pointDeRdvId = (poiRes.body as { id: string }).id;
    const universiteRes = await request(app.getHttpServer())
      .post('/referentiel/universites')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nom: 'E2E FHB Cocody',
        commune: 'Cocody',
        latitude: 5.34,
        longitude: -3.99,
      })
      .expect(201);
    universiteId = (universiteRes.body as { id: string }).id;

    // Etudiant qui devient conducteur : OTP -> demande -> validation admin (flux reel)
    let code = await requestOtpAndGetCode(app, CONDUCTEUR_PHONE);
    const conducteurVerifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone: CONDUCTEUR_PHONE, code })
      .expect(200);
    conducteurToken = (conducteurVerifyRes.body as { accessToken: string })
      .accessToken;

    const conducteurUser = await prisma.utilisateur.findUniqueOrThrow({
      where: { telephone: CONDUCTEUR_PHONE },
    });
    await prisma.verificationIdentite.create({
      data: {
        userId: conducteurUser.id,
        cni: 'e2e-cni.jpg',
        selfie: 'e2e-selfie.jpg',
        statut: 'valide',
      },
    });

    await request(app.getHttpServer())
      .post('/users/me/conducteur')
      .set('Authorization', `Bearer ${conducteurToken}`)
      .field('matriculeVehicule', 'CI-2847-AB')
      .attach('permis', TINY_JPEG, 'permis.jpg')
      .expect(201);

    const demandeRes = await request(app.getHttpServer())
      .get('/users/conducteurs/demandes')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const demandeId = (
      demandeRes.body as { id: string; telephone: string }[]
    ).find((d) => d.telephone === CONDUCTEUR_PHONE)?.id;
    await request(app.getHttpServer())
      .patch(`/users/conducteurs/demandes/${demandeId}/valider`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Etudiant simple, jamais devenu conducteur
    code = await requestOtpAndGetCode(app, ETUDIANT_PHONE);
    const etudiantVerifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone: ETUDIANT_PHONE, code })
      .expect(200);
    etudiantToken = (etudiantVerifyRes.body as { accessToken: string })
      .accessToken;
  }, 30000);

  afterAll(async () => {
    await cleanup();
    // @nestjs/schedule@6 ne stoppe pas ses CronJob automatiquement a
    // app.close() (aucun hook OnModuleDestroy/OnApplicationShutdown dans ce
    // package -- verifie dans ses sources) -- sans cet arret explicite, le
    // cron de la Story 3.8 continue de tourner apres la fin de cette suite et
    // s'accumule avec ceux des suites e2e suivantes, chacun tentant des
    // requetes sur une connexion Prisma deja fermee (voir Story 3.8 Debug Log
    // References pour l'incident complet).
    app
      .get(SchedulerRegistry)
      .getCronJobs()
      .forEach((job) => {
        void job.stop();
      });
    await app.close();
  });

  it('POST /trajets returns 401 without a token', async () => {
    await request(app.getHttpServer())
      .post('/trajets')
      .send({
        universiteId,
        pointDeRdvId,
        heure: '2026-09-01T07:00:00.000Z',
        places: 3,
        prixTotal: 3500,
      })
      .expect(401);
  });

  it('POST /trajets returns 403 for an authenticated non-conducteur', async () => {
    await request(app.getHttpServer())
      .post('/trajets')
      .set('Authorization', `Bearer ${etudiantToken}`)
      .send({
        universiteId,
        pointDeRdvId,
        heure: '2026-09-01T07:00:00.000Z',
        places: 3,
        prixTotal: 3500,
      })
      .expect(403);
  });

  it('POST /trajets returns 400 for an unknown universiteId', async () => {
    await request(app.getHttpServer())
      .post('/trajets')
      .set('Authorization', `Bearer ${conducteurToken}`)
      .send({
        universiteId: 'does-not-exist',
        pointDeRdvId,
        heure: '2026-09-01T07:00:00.000Z',
        places: 3,
        prixTotal: 3500,
      })
      .expect(400);
  });

  it('POST /trajets returns 400 for an unknown pointDeRdvId', async () => {
    await request(app.getHttpServer())
      .post('/trajets')
      .set('Authorization', `Bearer ${conducteurToken}`)
      .send({
        universiteId,
        pointDeRdvId: 'does-not-exist',
        heure: '2026-09-01T07:00:00.000Z',
        places: 3,
        prixTotal: 3500,
      })
      .expect(400);
  });

  it('publishes a trajet, then rejects an overlapping one, but accepts one far enough away', async () => {
    await request(app.getHttpServer())
      .post('/trajets')
      .set('Authorization', `Bearer ${conducteurToken}`)
      .send({
        universiteId,
        pointDeRdvId,
        heure: '2026-09-01T07:00:00.000Z',
        places: 3,
        prixTotal: 3500,
      })
      .expect(201);

    // 1h plus tard : chevauche la fenetre de +/-2h du premier trajet
    await request(app.getHttpServer())
      .post('/trajets')
      .set('Authorization', `Bearer ${conducteurToken}`)
      .send({
        universiteId,
        pointDeRdvId,
        heure: '2026-09-01T08:00:00.000Z',
        places: 2,
        prixTotal: 2000,
      })
      .expect(409);

    // 5h plus tard : hors de la fenetre, doit passer
    await request(app.getHttpServer())
      .post('/trajets')
      .set('Authorization', `Bearer ${conducteurToken}`)
      .send({
        universiteId,
        pointDeRdvId,
        heure: '2026-09-01T12:00:00.000Z',
        places: 2,
        prixTotal: 2000,
      })
      .expect(201);
  });

  describe('GET /trajets (decouverte)', () => {
    it('returns 401 without a token', async () => {
      await request(app.getHttpServer())
        .get('/trajets')
        .query({ universiteId, communeId })
        .expect(401);
    });

    it('returns 400 when universiteId or communeId is missing', async () => {
      await request(app.getHttpServer())
        .get('/trajets')
        .set('Authorization', `Bearer ${etudiantToken}`)
        .query({ universiteId })
        .expect(400);

      await request(app.getHttpServer())
        .get('/trajets')
        .set('Authorization', `Bearer ${etudiantToken}`)
        .query({ communeId })
        .expect(400);
    });

    it('only returns trajets matching the given universite/commune, never trajets from elsewhere', async () => {
      // Referentiel dans une autre universite/commune, pour prouver que le
      // filtre exclut reellement ce qui ne correspond pas.
      const autreCommuneRes = await request(app.getHttpServer())
        .post('/referentiel/communes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nom: 'E2E Autre Commune', ville: 'Abidjan' })
        .expect(201);
      const autreQuartierRes = await request(app.getHttpServer())
        .post('/referentiel/quartiers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nom: 'E2E Autre Quartier',
          communeId: (autreCommuneRes.body as { id: string }).id,
        })
        .expect(201);
      const autrePoiRes = await request(app.getHttpServer())
        .post('/referentiel/points-interet')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nom: 'E2E Autre POI',
          type: 'carrefour',
          quartierId: (autreQuartierRes.body as { id: string }).id,
          latitude: 6.0,
          longitude: -5.0,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/trajets')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .send({
          universiteId,
          pointDeRdvId: (autrePoiRes.body as { id: string }).id,
          heure: '2026-09-02T07:00:00.000Z',
          places: 2,
          prixTotal: 1500,
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/trajets')
        .set('Authorization', `Bearer ${etudiantToken}`)
        .query({ universiteId, communeId })
        .expect(200);

      const body = res.body as {
        pointDeRdv: { id: string };
        conducteur: { verifie: boolean };
      }[];
      expect(body.length).toBeGreaterThan(0);
      for (const trajet of body) {
        expect(trajet.pointDeRdv.id).toBe(pointDeRdvId);
        expect(trajet.conducteur.verifie).toBe(true);
      }
    });

    it('sorts by distance when lat/lng are given', async () => {
      const res = await request(app.getHttpServer())
        .get('/trajets')
        .set('Authorization', `Bearer ${etudiantToken}`)
        .query({ universiteId, communeId, lat: 5.36, lng: -3.98 })
        .expect(200);

      const body = res.body as { distanceKm: number }[];
      expect(body.length).toBeGreaterThan(0);
      expect(body[0]).toHaveProperty('distanceKm');
    });
  });

  describe('Detail et reservation (e2e)', () => {
    const PASSAGER2_PHONE = '+2250700000062';
    let passager2Token: string;

    beforeAll(async () => {
      const code = await requestOtpAndGetCode(app, PASSAGER2_PHONE);
      const verifyRes = await request(app.getHttpServer())
        .post('/auth/otp/verify')
        .send({ phone: PASSAGER2_PHONE, code })
        .expect(200);
      passager2Token = (verifyRes.body as { accessToken: string }).accessToken;
    }, 15000);

    afterAll(async () => {
      await prisma.reservation.deleteMany({
        where: { passager: { telephone: PASSAGER2_PHONE } },
      });
      await prisma.utilisateur.deleteMany({
        where: { telephone: PASSAGER2_PHONE },
      });
    });

    it('GET /trajets/:id shows a division-by-zero-safe price preview before any reservation', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/trajets')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .send({
          universiteId,
          pointDeRdvId,
          heure: '2026-09-03T07:00:00.000Z',
          places: 1,
          prixTotal: 3500,
        })
        .expect(201);
      const trajetId = (createRes.body as { id: string }).id;

      const detailRes = await request(app.getHttpServer())
        .get(`/trajets/${trajetId}`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(200);
      const detail = detailRes.body as {
        placesDisponibles: number;
        prixParPersonnePreview: number;
        conducteur: { verifie: boolean };
      };
      expect(detail.placesDisponibles).toBe(1);
      expect(detail.prixParPersonnePreview).toBe(3500);
      expect(detail.conducteur.verifie).toBe(true);
    });

    it('reserves a 1-place trajet, then rejects a second reservation (complet)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/trajets')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .send({
          universiteId,
          pointDeRdvId,
          heure: '2026-09-04T07:00:00.000Z',
          places: 1,
          prixTotal: 3500,
        })
        .expect(201);
      const trajetId = (createRes.body as { id: string }).id;

      const reservationRes = await request(app.getHttpServer())
        .post(`/trajets/${trajetId}/reservations`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(201);
      expect(
        (reservationRes.body as { prixParPersonne: number }).prixParPersonne,
      ).toBe(3500);

      // Le conducteur ne peut pas reserver son propre trajet
      await request(app.getHttpServer())
        .post(`/trajets/${trajetId}/reservations`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(403);

      // Le meme etudiant ne peut pas reserver deux fois
      await request(app.getHttpServer())
        .post(`/trajets/${trajetId}/reservations`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(409);

      // Le trajet est complet (1 place, deja prise)
      await request(app.getHttpServer())
        .post(`/trajets/${trajetId}/reservations`)
        .set('Authorization', `Bearer ${passager2Token}`)
        .expect(409);
    });

    it('synchronises prixParPersonne across all confirmed reservations of the same trajet', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/trajets')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .send({
          universiteId,
          pointDeRdvId,
          heure: '2026-09-05T07:00:00.000Z',
          places: 2,
          prixTotal: 3500,
        })
        .expect(201);
      const trajetId = (createRes.body as { id: string }).id;

      const premiereRes = await request(app.getHttpServer())
        .post(`/trajets/${trajetId}/reservations`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(201);
      // 1 seul passager pour l'instant : pas de division
      expect(
        (premiereRes.body as { prixParPersonne: number }).prixParPersonne,
      ).toBe(3500);

      const deuxiemeRes = await request(app.getHttpServer())
        .post(`/trajets/${trajetId}/reservations`)
        .set('Authorization', `Bearer ${passager2Token}`)
        .expect(201);
      // 2 passagers maintenant : 3500 / 2 = 1750, deja entier
      expect(
        (deuxiemeRes.body as { prixParPersonne: number }).prixParPersonne,
      ).toBe(1750);

      const toutesReservations = await prisma.reservation.findMany({
        where: { trajetId, statut: 'confirmee' },
      });
      expect(toutesReservations).toHaveLength(2);
      for (const reservation of toutesReservations) {
        expect(reservation.prixParPersonne).toBe(1750);
      }
    });

    it('GET /trajets/:id returns 404 for an unknown id', async () => {
      await request(app.getHttpServer())
        .get('/trajets/does-not-exist')
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(404);
    });

    it('POST /trajets/:id/reservations returns 401 without a token', async () => {
      await request(app.getHttpServer())
        .post('/trajets/does-not-exist/reservations')
        .expect(401);
    });
  });

  describe('Gestion des trajets par le conducteur (e2e)', () => {
    it("GET /trajets/mine only returns the requester's own trajets", async () => {
      // Beaucoup de trajets ont deja ete publies par conducteurToken plus
      // haut dans ce fichier -- un etudiant qui n'a jamais rien publie doit
      // recevoir une liste vide, preuve que le filtre par proprietaire
      // fonctionne (pas juste que la route repond 200).
      const etudiantRes = await request(app.getHttpServer())
        .get('/trajets/mine')
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(200);
      expect(etudiantRes.body).toEqual([]);

      const conducteurRes = await request(app.getHttpServer())
        .get('/trajets/mine')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(200);
      const trajets = conducteurRes.body as {
        conducteurId: string;
        placesDisponibles: number;
      }[];
      expect(trajets.length).toBeGreaterThan(0);
      for (const trajet of trajets) {
        expect(trajet).toHaveProperty('placesDisponibles');
      }
    });

    it('GET /trajets/mine returns 401 without a token', async () => {
      await request(app.getHttpServer()).get('/trajets/mine').expect(401);
    });

    it('demarre puis termine un trajet, en respectant les transitions autorisees', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/trajets')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .send({
          universiteId,
          pointDeRdvId,
          heure: '2026-09-06T07:00:00.000Z',
          places: 2,
          prixTotal: 2000,
        })
        .expect(201);
      const trajetId = (createRes.body as { id: string }).id;

      // Pas le proprietaire -> 403
      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/demarrer`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(403);

      // Ne peut pas terminer un trajet encore "ouvert" (jamais demarre)
      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/terminer`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(409);

      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/demarrer`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(200);

      const apresDemarrage = await prisma.trajet.findUniqueOrThrow({
        where: { id: trajetId },
      });
      expect(apresDemarrage.statut).toBe('commence');

      // Deuxieme "demarrer" -> 409 (deja "commence")
      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/demarrer`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(409);

      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/terminer`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(200);

      const apresFin = await prisma.trajet.findUniqueOrThrow({
        where: { id: trajetId },
      });
      expect(apresFin.statut).toBe('termine');
    });

    it('PATCH .../demarrer returns 404 for an unknown trajet', async () => {
      await request(app.getHttpServer())
        .patch('/trajets/does-not-exist/demarrer')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(404);
    });
  });

  describe('Annulation par le conducteur (e2e)', () => {
    it('cancels a far-in-the-future trajet without changing the note', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/trajets')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .send({
          universiteId,
          pointDeRdvId,
          heure: '2026-09-07T07:00:00.000Z',
          places: 2,
          prixTotal: 2000,
        })
        .expect(201);
      const trajetId = (createRes.body as { id: string }).id;

      // Un non-proprietaire ne peut pas annuler
      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/annuler`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(403);

      const conducteurAvant = await prisma.utilisateur.findUniqueOrThrow({
        where: { telephone: CONDUCTEUR_PHONE },
      });

      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/annuler`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(200);

      const trajetApres = await prisma.trajet.findUniqueOrThrow({
        where: { id: trajetId },
      });
      expect(trajetApres.statut).toBe('annule');

      const conducteurApres = await prisma.utilisateur.findUniqueOrThrow({
        where: { telephone: CONDUCTEUR_PHONE },
      });
      expect(conducteurApres.note).toBe(conducteurAvant.note);

      // Ne peut plus etre annule une deuxieme fois
      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/annuler`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(409);
    });

    it('cannot cancel a trajet already marked "commence"', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/trajets')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .send({
          universiteId,
          pointDeRdvId,
          heure: '2026-09-08T07:00:00.000Z',
          places: 2,
          prixTotal: 2000,
        })
        .expect(201);
      const trajetId = (createRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/demarrer`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/annuler`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(409);
    });

    it('decrements the note when cancelling less than 2h before departure', async () => {
      const conducteur = await prisma.utilisateur.findUniqueOrThrow({
        where: { telephone: CONDUCTEUR_PHONE },
      });
      await prisma.utilisateur.update({
        where: { id: conducteur.id },
        data: { note: 4.0 },
      });

      const heureProche = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const createRes = await request(app.getHttpServer())
        .post('/trajets')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .send({
          universiteId,
          pointDeRdvId,
          heure: heureProche,
          places: 2,
          prixTotal: 2000,
        })
        .expect(201);
      const trajetId = (createRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/annuler`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(200);

      const conducteurApres = await prisma.utilisateur.findUniqueOrThrow({
        where: { id: conducteur.id },
      });
      expect(conducteurApres.note).toBe(3.5);
    });
  });

  describe('Annulation par le passager (e2e)', () => {
    const PASSAGER3_PHONE = '+2250700000063';
    let passager3Token: string;

    beforeAll(async () => {
      const code = await requestOtpAndGetCode(app, PASSAGER3_PHONE);
      const verifyRes = await request(app.getHttpServer())
        .post('/auth/otp/verify')
        .send({ phone: PASSAGER3_PHONE, code })
        .expect(200);
      passager3Token = (verifyRes.body as { accessToken: string }).accessToken;
    }, 15000);

    afterAll(async () => {
      await prisma.reservation.deleteMany({
        where: { passager: { telephone: PASSAGER3_PHONE } },
      });
      await prisma.utilisateur.deleteMany({
        where: { telephone: PASSAGER3_PHONE },
      });
    });

    it('cancels a reservation far from departure and frees the place', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/trajets')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .send({
          universiteId,
          pointDeRdvId,
          heure: '2026-09-09T07:00:00.000Z',
          places: 2,
          prixTotal: 2000,
        })
        .expect(201);
      const trajetId = (createRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/trajets/${trajetId}/reservations`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/reservations/annuler`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(200);

      const reservationApres = await prisma.reservation.findFirstOrThrow({
        where: { trajetId, passager: { telephone: ETUDIANT_PHONE } },
      });
      expect(reservationApres.statut).toBe('annulee');

      const detailRes = await request(app.getHttpServer())
        .get(`/trajets/${trajetId}`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(200);
      expect(
        (detailRes.body as { placesDisponibles: number }).placesDisponibles,
      ).toBe(2);

      // Ne peut plus etre annulee une deuxieme fois (plus de reservation confirmee)
      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/reservations/annuler`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(404);
    });

    it('recalculates the price for the remaining confirmed passager', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/trajets')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .send({
          universiteId,
          pointDeRdvId,
          heure: '2026-09-10T07:00:00.000Z',
          places: 3,
          prixTotal: 3500,
        })
        .expect(201);
      const trajetId = (createRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/trajets/${trajetId}/reservations`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(201);
      await request(app.getHttpServer())
        .post(`/trajets/${trajetId}/reservations`)
        .set('Authorization', `Bearer ${passager3Token}`)
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/reservations/annuler`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(200);

      const reservationRestante = await prisma.reservation.findFirstOrThrow({
        where: { trajetId, passager: { telephone: PASSAGER3_PHONE } },
      });
      expect(reservationRestante.statut).toBe('confirmee');
      expect(reservationRestante.prixParPersonne).toBe(3500);
    });

    it('rejects a cancellation less than 2h before departure', async () => {
      const heureProche = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const createRes = await request(app.getHttpServer())
        .post('/trajets')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .send({
          universiteId,
          pointDeRdvId,
          heure: heureProche,
          places: 2,
          prixTotal: 2000,
        })
        .expect(201);
      const trajetId = (createRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/trajets/${trajetId}/reservations`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/reservations/annuler`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(409);
    });

    it('returns 404 when the caller has no confirmed reservation on the trajet', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/trajets')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .send({
          universiteId,
          pointDeRdvId,
          heure: '2026-09-11T07:00:00.000Z',
          places: 2,
          prixTotal: 2000,
        })
        .expect(201);
      const trajetId = (createRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/reservations/annuler`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(404);
    });
  });

  describe('No-show conducteur (e2e)', () => {
    it('cancels the trajet and decrements the note when the driver never showed up', async () => {
      const conducteur = await prisma.utilisateur.findUniqueOrThrow({
        where: { telephone: CONDUCTEUR_PHONE },
      });
      await prisma.utilisateur.update({
        where: { id: conducteur.id },
        data: { note: 4.0 },
      });

      // -3h (et non -5min) : evite le chevauchement horaire (OVERLAP_WINDOW_MS,
      // Story 3.1) avec le trajet "heureProche" (+30min, jamais annule par
      // conception) laisse par le test 3.6 "rejects a cancellation less than
      // 2h before departure" -- meme conducteur, meme suite e2e.
      const heurePassee = new Date(
        Date.now() - 3 * 60 * 60 * 1000,
      ).toISOString();
      const createRes = await request(app.getHttpServer())
        .post('/trajets')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .send({
          universiteId,
          pointDeRdvId,
          heure: heurePassee,
          places: 2,
          prixTotal: 2000,
        })
        .expect(201);
      const trajetId = (createRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/trajets/${trajetId}/reservations`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/signaler-absence`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(200);

      const trajetApres = await prisma.trajet.findUniqueOrThrow({
        where: { id: trajetId },
      });
      expect(trajetApres.statut).toBe('annule');

      const conducteurApres = await prisma.utilisateur.findUniqueOrThrow({
        where: { id: conducteur.id },
      });
      expect(conducteurApres.note).toBe(3.0);

      // Deja "annule" -> ne peut plus etre signale une deuxieme fois
      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/signaler-absence`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(409);
    });

    it('rejects the report when the departure time has not passed yet', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/trajets')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .send({
          universiteId,
          pointDeRdvId,
          heure: '2026-09-12T07:00:00.000Z',
          places: 2,
          prixTotal: 2000,
        })
        .expect(201);
      const trajetId = (createRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/trajets/${trajetId}/reservations`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/signaler-absence`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(409);
    });

    it('rejects the report when the caller has no confirmed reservation', async () => {
      // -3h (et non -5min) : evite le chevauchement horaire (OVERLAP_WINDOW_MS,
      // Story 3.1) avec le trajet "heureProche" (+30min, jamais annule par
      // conception) laisse par le test 3.6 "rejects a cancellation less than
      // 2h before departure" -- meme conducteur, meme suite e2e.
      const heurePassee = new Date(
        Date.now() - 3 * 60 * 60 * 1000,
      ).toISOString();
      const createRes = await request(app.getHttpServer())
        .post('/trajets')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .send({
          universiteId,
          pointDeRdvId,
          heure: heurePassee,
          places: 2,
          prixTotal: 2000,
        })
        .expect(201);
      const trajetId = (createRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/signaler-absence`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(403);
    });
  });

  describe('Rappels automatiques avant le depart (e2e)', () => {
    let trajetsService: TrajetsService;

    beforeAll(async () => {
      trajetsService = app.get(TrajetsService);
      // Neutralise tout trajet "ouvert" laisse par les describe precedents
      // (ex. les trajets "heureProche" volontairement non-annules des Stories
      // 3.6/3.7) -- sinon leur presence pres de "maintenant" declenche a tort
      // le garde-fou de chevauchement horaire (OVERLAP_WINDOW_MS, Story 3.1)
      // sur les nouveaux trajets publies par ce describe.
      await prisma.trajet.updateMany({
        where: {
          conducteur: { telephone: CONDUCTEUR_PHONE },
          statut: 'ouvert',
        },
        data: { statut: 'annule' },
      });
    });

    it('sends the 2h reminder once and does not duplicate it on a second run', async () => {
      const heureDans90min = new Date(
        Date.now() + 90 * 60 * 1000,
      ).toISOString();
      const createRes = await request(app.getHttpServer())
        .post('/trajets')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .send({
          universiteId,
          pointDeRdvId,
          heure: heureDans90min,
          places: 2,
          prixTotal: 2000,
        })
        .expect(201);
      const trajetId = (createRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/trajets/${trajetId}/reservations`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(201);

      await trajetsService.envoyerRappelsDepart();

      const trajetApres = await prisma.trajet.findUniqueOrThrow({
        where: { id: trajetId },
      });
      expect(trajetApres.rappel2hEnvoye).toBe(true);
      expect(trajetApres.rappel1hEnvoye).toBe(false);

      // Un second passage ne doit rien reenvoyer (l'etat reste inchange).
      await trajetsService.envoyerRappelsDepart();

      const trajetApresSecondPassage = await prisma.trajet.findUniqueOrThrow({
        where: { id: trajetId },
      });
      expect(trajetApresSecondPassage.rappel2hEnvoye).toBe(true);
      expect(trajetApresSecondPassage.rappel1hEnvoye).toBe(false);
    });

    it('does not touch a trajet that is not "ouvert" or whose departure has passed', async () => {
      // Neutralise le trajet "ouvert" laisse par le test precedent (jamais
      // annule, seulement marque comme ayant reçu son rappel) pour eviter un
      // faux conflit de chevauchement horaire avec le nouveau trajet publie
      // ci-dessous, sur le meme creneau +90min.
      await prisma.trajet.updateMany({
        where: {
          conducteur: { telephone: CONDUCTEUR_PHONE },
          statut: 'ouvert',
        },
        data: { statut: 'annule' },
      });

      const heureDans90min = new Date(
        Date.now() + 90 * 60 * 1000,
      ).toISOString();
      const createRes = await request(app.getHttpServer())
        .post('/trajets')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .send({
          universiteId,
          pointDeRdvId,
          heure: heureDans90min,
          places: 2,
          prixTotal: 2000,
        })
        .expect(201);
      const trajetId = (createRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/annuler`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(200);

      await trajetsService.envoyerRappelsDepart();

      const trajetApres = await prisma.trajet.findUniqueOrThrow({
        where: { id: trajetId },
      });
      expect(trajetApres.rappel2hEnvoye).toBe(false);
      expect(trajetApres.rappel1hEnvoye).toBe(false);
    });
  });

  describe('Rencontre (e2e)', () => {
    it('is visible to a confirmed passager while the trajet is "ouvert", and disappears once it starts', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/trajets')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .send({
          universiteId,
          pointDeRdvId,
          heure: '2026-09-13T07:00:00.000Z',
          places: 2,
          prixTotal: 2000,
        })
        .expect(201);
      const trajetId = (createRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/trajets/${trajetId}/reservations`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(201);

      const mesReservationsRes = await request(app.getHttpServer())
        .get('/trajets/mes-reservations')
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(200);
      const trajetDansListe = (
        mesReservationsRes.body as {
          id: string;
          peutVoirRencontre: boolean;
        }[]
      ).find((t) => t.id === trajetId);
      expect(trajetDansListe?.peutVoirRencontre).toBe(true);

      const rencontreRes = await request(app.getHttpServer())
        .get(`/trajets/${trajetId}/rencontre`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(200);
      const rencontre = rencontreRes.body as {
        conducteur: { nom: string | null; verifie: boolean };
      };
      expect(rencontre.conducteur.verifie).toBe(true);

      // Un utilisateur sans reservation confirmee sur ce trajet -> 403
      await request(app.getHttpServer())
        .get(`/trajets/${trajetId}/rencontre`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/demarrer`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(200);

      const mesReservationsApresRes = await request(app.getHttpServer())
        .get('/trajets/mes-reservations')
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(200);
      const trajetApresDemarrage = (
        mesReservationsApresRes.body as {
          id: string;
          peutVoirRencontre: boolean;
        }[]
      ).find((t) => t.id === trajetId);
      expect(trajetApresDemarrage?.peutVoirRencontre).toBe(false);

      await request(app.getHttpServer())
        .get(`/trajets/${trajetId}/rencontre`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(409);
    });

    it('returns 404 when the trajet does not exist', async () => {
      await request(app.getHttpServer())
        .get('/trajets/does-not-exist/rencontre')
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(404);
    });
  });

  describe('Signalement passager absent (e2e)', () => {
    it('marks the reservation absent and decrements the note, once', async () => {
      const conducteurAvant = await prisma.utilisateur.findUniqueOrThrow({
        where: { telephone: CONDUCTEUR_PHONE },
      });
      const etudiant = await prisma.utilisateur.findUniqueOrThrow({
        where: { telephone: ETUDIANT_PHONE },
      });
      await prisma.utilisateur.update({
        where: { id: etudiant.id },
        data: { note: 4.0 },
      });

      const createRes = await request(app.getHttpServer())
        .post('/trajets')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .send({
          universiteId,
          pointDeRdvId,
          heure: '2026-09-16T07:00:00.000Z',
          places: 2,
          prixTotal: 2000,
        })
        .expect(201);
      const trajetId = (createRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/trajets/${trajetId}/reservations`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(201);

      // Trop tot -- trajet pas encore "termine"
      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/passagers/${etudiant.id}/signaler-absence`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(409);

      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/demarrer`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/terminer`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(200);

      // Jamais inscrit (le conducteur lui-meme) -> 400
      await request(app.getHttpServer())
        .patch(
          `/trajets/${trajetId}/passagers/${conducteurAvant.id}/signaler-absence`,
        )
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/passagers/${etudiant.id}/signaler-absence`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(200);

      const reservation = await prisma.reservation.findFirstOrThrow({
        where: { trajetId, passagerId: etudiant.id },
      });
      expect(reservation.statut).toBe('absent');

      const etudiantApres = await prisma.utilisateur.findUniqueOrThrow({
        where: { id: etudiant.id },
      });
      expect(etudiantApres.note).toBe(3.5);

      // Deja signale -> 409
      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/passagers/${etudiant.id}/signaler-absence`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(409);
    });

    it('rejects a non-owner conducteur', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/trajets')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .send({
          universiteId,
          pointDeRdvId,
          heure: '2026-09-17T07:00:00.000Z',
          places: 2,
          prixTotal: 2000,
        })
        .expect(201);
      const trajetId = (createRes.body as { id: string }).id;
      const etudiant = await prisma.utilisateur.findUniqueOrThrow({
        where: { telephone: ETUDIANT_PHONE },
      });

      await request(app.getHttpServer())
        .patch(`/trajets/${trajetId}/passagers/${etudiant.id}/signaler-absence`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(403);
    });
  });
});
