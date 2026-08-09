import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import bcryptjs from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { DemandesService } from '../src/demandes/demandes.service';

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

describe('Demandes (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let demandesService: DemandesService;
  let adminToken: string;
  let etudiantToken: string;
  let conducteurToken: string;
  let universiteId: string;
  let communeId: string;
  let poiId: string;

  const ADMIN_EMAIL = 'admin-demandes-e2e@campusride.ci';
  const ADMIN_PASSWORD = 'un-mot-de-passe-suffisamment-long';
  const ETUDIANT_PHONE = '+2250700000070';
  const CONDUCTEUR_PHONE = '+2250700000079';
  const TINY_JPEG = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9,
  ]);

  async function cleanup() {
    await prisma.reservation.deleteMany({
      where: { trajet: { conducteur: { telephone: CONDUCTEUR_PHONE } } },
    });
    await prisma.trajet.deleteMany({
      where: { conducteur: { telephone: CONDUCTEUR_PHONE } },
    });
    await prisma.documentsConducteur.deleteMany({
      where: { utilisateur: { telephone: CONDUCTEUR_PHONE } },
    });
    await prisma.participation.deleteMany({
      where: { utilisateur: { telephone: ETUDIANT_PHONE } },
    });
    await prisma.demande.deleteMany({
      where: { createur: { telephone: ETUDIANT_PHONE } },
    });
    await prisma.utilisateur.deleteMany({ where: { email: ADMIN_EMAIL } });
    await prisma.utilisateur.deleteMany({
      where: { telephone: { in: [ETUDIANT_PHONE, CONDUCTEUR_PHONE] } },
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
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    demandesService = app.get(DemandesService);

    await cleanup();

    const passwordHash = await bcryptjs.hash(ADMIN_PASSWORD, 12);
    await prisma.utilisateur.create({
      data: { email: ADMIN_EMAIL, passwordHash, role: 'admin' },
    });
    const adminLoginRes = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    adminToken = (adminLoginRes.body as { accessToken: string }).accessToken;

    const communeRes = await request(app.getHttpServer())
      .post('/referentiel/communes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'E2E Cocody', ville: 'Abidjan' })
      .expect(201);
    communeId = (communeRes.body as { id: string }).id;
    const quartierRes = await request(app.getHttpServer())
      .post('/referentiel/quartiers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'E2E Angre', communeId })
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
    poiId = (poiRes.body as { id: string }).id;
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

    const code = await requestOtpAndGetCode(app, ETUDIANT_PHONE);
    const etudiantVerifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone: ETUDIANT_PHONE, code })
      .expect(200);
    etudiantToken = (etudiantVerifyRes.body as { accessToken: string })
      .accessToken;

    // Conducteur valide (flux reel OTP -> demande -> validation admin, meme
    // pattern que trajets.e2e-spec.ts) -- necessaire pour la Story 4.5
    // (accepter une demande).
    const conducteurCode = await requestOtpAndGetCode(app, CONDUCTEUR_PHONE);
    const conducteurVerifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone: CONDUCTEUR_PHONE, code: conducteurCode })
      .expect(200);
    conducteurToken = (conducteurVerifyRes.body as { accessToken: string })
      .accessToken;

    await request(app.getHttpServer())
      .post('/users/me/conducteur')
      .set('Authorization', `Bearer ${conducteurToken}`)
      .field('matriculeVehicule', 'CI-2847-AB')
      .attach('selfie', TINY_JPEG, 'selfie.jpg')
      .attach('permis', TINY_JPEG, 'permis.jpg')
      .expect(201);

    const demandeConducteurRes = await request(app.getHttpServer())
      .get('/users/conducteurs/demandes')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const demandeConducteurId = (
      demandeConducteurRes.body as { id: string; telephone: string }[]
    ).find((d) => d.telephone === CONDUCTEUR_PHONE)?.id;
    await request(app.getHttpServer())
      .patch(`/users/conducteurs/demandes/${demandeConducteurId}/valider`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  }, 30000);

  afterAll(async () => {
    await cleanup();
    // Voir trajets.e2e-spec.ts : @nestjs/schedule@6 ne stoppe pas ses
    // CronJob a app.close(), a arreter explicitement.
    app
      .get(SchedulerRegistry)
      .getCronJobs()
      .forEach((job) => {
        void job.stop();
      });
    await app.close();
  });

  it('POST /demandes returns 401 without a token', async () => {
    await request(app.getHttpServer())
      .post('/demandes')
      .send({
        universiteId,
        communeId,
        heure: '2026-09-01T07:00:00.000Z',
        placesRecherchees: 4,
        cotisation: 500,
        chezMoi: true,
        lat: 5.36,
        lng: -3.98,
      })
      .expect(401);
  });

  it('creates a Demande and the createur Participation when chezMoi is true', async () => {
    const res = await request(app.getHttpServer())
      .post('/demandes')
      .set('Authorization', `Bearer ${etudiantToken}`)
      .send({
        universiteId,
        communeId,
        heure: '2026-09-01T07:00:00.000Z',
        placesRecherchees: 4,
        cotisation: 500,
        chezMoi: true,
        lat: 5.36,
        lng: -3.98,
      })
      .expect(201);
    const demandeId = (res.body as { id: string; statut: string }).id;
    expect((res.body as { statut: string }).statut).toBe('ouverte');

    const participation = await prisma.participation.findFirstOrThrow({
      where: { demandeId },
    });
    expect(participation.positionLat).toBe(5.36);
    expect(participation.positionLng).toBe(-3.98);
    expect(participation.statut).toBe('confirmee');
  });

  it('creates a Participation with the POI coordinates when chezMoi is false', async () => {
    const res = await request(app.getHttpServer())
      .post('/demandes')
      .set('Authorization', `Bearer ${etudiantToken}`)
      .send({
        universiteId,
        communeId,
        heure: '2026-09-02T07:00:00.000Z',
        placesRecherchees: 3,
        cotisation: 400,
        chezMoi: false,
        poiId,
      })
      .expect(201);
    const demandeId = (res.body as { id: string }).id;

    const participation = await prisma.participation.findFirstOrThrow({
      where: { demandeId },
    });
    expect(participation.positionLat).toBe(5.36);
    expect(participation.positionLng).toBe(-3.98);
  });

  it('rejects chezMoi false without a poiId', async () => {
    await request(app.getHttpServer())
      .post('/demandes')
      .set('Authorization', `Bearer ${etudiantToken}`)
      .send({
        universiteId,
        communeId,
        heure: '2026-09-03T07:00:00.000Z',
        placesRecherchees: 2,
        cotisation: 300,
        chezMoi: false,
      })
      .expect(400);
  });

  it('GET /demandes filters by universite/commune and only returns "ouverte" demandes', async () => {
    const res = await request(app.getHttpServer())
      .get('/demandes')
      .set('Authorization', `Bearer ${etudiantToken}`)
      .query({ universiteId, communeId })
      .expect(200);

    const body = res.body as {
      statut: string;
      createur: { id: string };
      placesRestantes: number;
    }[];
    expect(body.length).toBeGreaterThanOrEqual(2);
    for (const demande of body) {
      expect(demande.statut).toBe('ouverte');
      expect(typeof demande.placesRestantes).toBe('number');
    }
  });

  it('GET /demandes/mine returns demandes where the caller has a confirmed participation', async () => {
    const res = await request(app.getHttpServer())
      .get('/demandes/mine')
      .set('Authorization', `Bearer ${etudiantToken}`)
      .expect(200);

    const body = res.body as {
      id: string;
      statut: string;
      placesConfirmees: number;
    }[];
    expect(body.length).toBeGreaterThanOrEqual(2);
    for (const demande of body) {
      expect(typeof demande.placesConfirmees).toBe('number');
    }
  });

  describe('Rejoindre une demande (e2e)', () => {
    const PARTICIPANT2_PHONE = '+2250700000071';
    const PARTICIPANT3_PHONE = '+2250700000072';
    let participant2Token: string;
    let participant3Token: string;

    beforeAll(async () => {
      for (const [phone, setToken] of [
        [PARTICIPANT2_PHONE, (t: string) => (participant2Token = t)],
        [PARTICIPANT3_PHONE, (t: string) => (participant3Token = t)],
      ] as const) {
        const code = await requestOtpAndGetCode(app, phone);
        const verifyRes = await request(app.getHttpServer())
          .post('/auth/otp/verify')
          .send({ phone, code })
          .expect(200);
        setToken((verifyRes.body as { accessToken: string }).accessToken);
      }
    }, 15000);

    afterAll(async () => {
      await prisma.participation.deleteMany({
        where: {
          utilisateur: {
            telephone: { in: [PARTICIPANT2_PHONE, PARTICIPANT3_PHONE] },
          },
        },
      });
      await prisma.utilisateur.deleteMany({
        where: { telephone: { in: [PARTICIPANT2_PHONE, PARTICIPANT3_PHONE] } },
      });
    });

    it('joins a 2-place demande, reaches quota (suggesting the nearby POI), then rejects a third participant', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/demandes')
        .set('Authorization', `Bearer ${etudiantToken}`)
        .send({
          universiteId,
          communeId,
          heure: '2026-09-04T07:00:00.000Z',
          placesRecherchees: 2,
          cotisation: 500,
          chezMoi: true,
          lat: 5.36,
          lng: -3.98,
        })
        .expect(201);
      const demandeId = (createRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/demandes/${demandeId}/participations`)
        .set('Authorization', `Bearer ${participant2Token}`)
        .send({ lat: 5.37, lng: -3.97 })
        .expect(201);

      // Le quota est atteint (2/2) -- la demande n'apparait plus dans
      // GET /demandes (filtre sur statut "ouverte", Story 4.1) puisque son
      // statut est desormais "quota_atteint" (Story 4.3) : verification
      // directe en base plutot que via le listing.
      const demandeApresQuota = await prisma.demande.findUniqueOrThrow({
        where: { id: demandeId },
      });
      expect(demandeApresQuota.statut).toBe('quota_atteint');
      expect(demandeApresQuota.poiId).toBe(poiId);

      // Quota atteint (2/2) -- un troisieme participant est rejete
      await request(app.getHttpServer())
        .post(`/demandes/${demandeId}/participations`)
        .set('Authorization', `Bearer ${participant3Token}`)
        .send({ lat: 5.35, lng: -3.99 })
        .expect(409);

      // Le createur ne peut pas rejoindre sa propre demande une seconde fois
      await request(app.getHttpServer())
        .post(`/demandes/${demandeId}/participations`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .send({ lat: 5.36, lng: -3.98 })
        .expect(409);
    });

    it('returns 404 when the demande does not exist', async () => {
      await request(app.getHttpServer())
        .post('/demandes/does-not-exist/participations')
        .set('Authorization', `Bearer ${participant2Token}`)
        .send({ lat: 5.36, lng: -3.98 })
        .expect(404);
    });

    it('reaches quota but leaves poiId untouched when the nearest POI is too far', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/demandes')
        .set('Authorization', `Bearer ${etudiantToken}`)
        .send({
          universiteId,
          communeId,
          heure: '2026-09-05T07:00:00.000Z',
          placesRecherchees: 2,
          cotisation: 500,
          // Loin de l'unique POI de cette commune (5.36, -3.98) --
          // aucun point fiable ne devrait etre suggere (> 1,5km).
          chezMoi: true,
          lat: 6.5,
          lng: -5.5,
        })
        .expect(201);
      const demandeId = (createRes.body as { id: string }).id;
      const demandeAvant = await prisma.demande.findUniqueOrThrow({
        where: { id: demandeId },
      });
      expect(demandeAvant.poiId).toBeNull();

      await request(app.getHttpServer())
        .post(`/demandes/${demandeId}/participations`)
        .set('Authorization', `Bearer ${participant3Token}`)
        .send({ lat: 6.51, lng: -5.51 })
        .expect(201);

      const demandeApres = await prisma.demande.findUniqueOrThrow({
        where: { id: demandeId },
      });
      expect(demandeApres.statut).toBe('quota_atteint');
      expect(demandeApres.poiId).toBeNull();
    });
  });

  describe('Expiration automatique (e2e)', () => {
    it('expires an "ouverte" demande within 2h when the scheduled task runs', async () => {
      const heureDans90min = new Date(
        Date.now() + 90 * 60 * 1000,
      ).toISOString();
      const createRes = await request(app.getHttpServer())
        .post('/demandes')
        .set('Authorization', `Bearer ${etudiantToken}`)
        .send({
          universiteId,
          communeId,
          heure: heureDans90min,
          placesRecherchees: 4,
          cotisation: 500,
          chezMoi: true,
          lat: 5.36,
          lng: -3.98,
        })
        .expect(201);
      const demandeId = (createRes.body as { id: string }).id;

      await demandesService.expirerDemandesEnRetard();

      const demandeApres = await prisma.demande.findUniqueOrThrow({
        where: { id: demandeId },
      });
      expect(demandeApres.statut).toBe('expiree');
    });

    it('does not expire an "ouverte" demande more than 2h away', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/demandes')
        .set('Authorization', `Bearer ${etudiantToken}`)
        .send({
          universiteId,
          communeId,
          heure: '2026-09-06T07:00:00.000Z',
          placesRecherchees: 4,
          cotisation: 500,
          chezMoi: true,
          lat: 5.36,
          lng: -3.98,
        })
        .expect(201);
      const demandeId = (createRes.body as { id: string }).id;

      await demandesService.expirerDemandesEnRetard();

      const demandeApres = await prisma.demande.findUniqueOrThrow({
        where: { id: demandeId },
      });
      expect(demandeApres.statut).toBe('ouverte');
    });
  });

  describe('Acceptation par un conducteur (e2e)', () => {
    const PARTICIPANT4_PHONE = '+2250700000073';
    let participant4Token: string;

    beforeAll(async () => {
      const code = await requestOtpAndGetCode(app, PARTICIPANT4_PHONE);
      const verifyRes = await request(app.getHttpServer())
        .post('/auth/otp/verify')
        .send({ phone: PARTICIPANT4_PHONE, code })
        .expect(200);
      participant4Token = (verifyRes.body as { accessToken: string })
        .accessToken;
    }, 15000);

    afterAll(async () => {
      await prisma.reservation.deleteMany({
        where: { passager: { telephone: PARTICIPANT4_PHONE } },
      });
      await prisma.participation.deleteMany({
        where: { utilisateur: { telephone: PARTICIPANT4_PHONE } },
      });
      await prisma.utilisateur.deleteMany({
        where: { telephone: PARTICIPANT4_PHONE },
      });
    });

    it('accepts a quota-reached demande, creating a Trajet mode "A" with a Reservation per participant', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/demandes')
        .set('Authorization', `Bearer ${etudiantToken}`)
        .send({
          universiteId,
          communeId,
          heure: '2026-09-07T07:00:00.000Z',
          placesRecherchees: 2,
          cotisation: 500,
          chezMoi: true,
          lat: 5.36,
          lng: -3.98,
        })
        .expect(201);
      const demandeId = (createRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/demandes/${demandeId}/participations`)
        .set('Authorization', `Bearer ${participant4Token}`)
        .send({ lat: 5.361, lng: -3.981 })
        .expect(201);

      const demandeAvantAcceptation = await prisma.demande.findUniqueOrThrow({
        where: { id: demandeId },
      });
      expect(demandeAvantAcceptation.statut).toBe('quota_atteint');
      expect(demandeAvantAcceptation.poiId).toBe(poiId);

      // "Demandes disponibles" (AC #1) -- la demande y apparait
      const disponiblesRes = await request(app.getHttpServer())
        .get('/demandes/disponibles')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .query({ universiteId, communeId })
        .expect(200);
      expect(
        (disponiblesRes.body as { id: string }[]).some(
          (d) => d.id === demandeId,
        ),
      ).toBe(true);

      const accepterRes = await request(app.getHttpServer())
        .post(`/demandes/${demandeId}/accepter`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(201);
      const trajetId = (accepterRes.body as { id: string }).id;

      const trajet = await prisma.trajet.findUniqueOrThrow({
        where: { id: trajetId },
      });
      expect(trajet.mode).toBe('A');
      expect(trajet.pointDeRdvId).toBe(poiId);
      expect(trajet.places).toBe(2);
      expect(trajet.prixTotal).toBe(1000);

      const reservations = await prisma.reservation.findMany({
        where: { trajetId },
      });
      expect(reservations).toHaveLength(2);
      for (const reservation of reservations) {
        expect(reservation.prixParPersonne).toBe(500);
        expect(reservation.statut).toBe('confirmee');
      }

      const demandeApresAcceptation = await prisma.demande.findUniqueOrThrow({
        where: { id: demandeId },
      });
      expect(demandeApresAcceptation.statut).toBe('acceptee');

      // Double acceptation -> rejetee (plus "quota_atteint")
      await request(app.getHttpServer())
        .post(`/demandes/${demandeId}/accepter`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(409);
    });

    it('returns 404 when the demande does not exist', async () => {
      await request(app.getHttpServer())
        .post('/demandes/does-not-exist/accepter')
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(404);
    });

    it('rejects acceptance of a demande that has not reached its quota', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/demandes')
        .set('Authorization', `Bearer ${etudiantToken}`)
        .send({
          universiteId,
          communeId,
          heure: '2026-09-08T07:00:00.000Z',
          placesRecherchees: 4,
          cotisation: 500,
          chezMoi: true,
          lat: 5.36,
          lng: -3.98,
        })
        .expect(201);
      const demandeId = (createRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/demandes/${demandeId}/accepter`)
        .set('Authorization', `Bearer ${conducteurToken}`)
        .expect(409);
    });
  });

  describe('Consultation par un tiers et annulation (e2e)', () => {
    const OBSERVATEUR_PHONE = '+2250700000078';
    let observateurToken: string;
    let demandeId: string;

    beforeAll(async () => {
      const code = await requestOtpAndGetCode(app, OBSERVATEUR_PHONE);
      const verifyRes = await request(app.getHttpServer())
        .post('/auth/otp/verify')
        .send({ phone: OBSERVATEUR_PHONE, code })
        .expect(200);
      observateurToken = (verifyRes.body as { accessToken: string })
        .accessToken;

      const createRes = await request(app.getHttpServer())
        .post('/demandes')
        .set('Authorization', `Bearer ${etudiantToken}`)
        .send({
          universiteId,
          communeId,
          heure: '2026-09-11T07:00:00.000Z',
          placesRecherchees: 4,
          cotisation: 500,
          chezMoi: true,
          lat: 5.36,
          lng: -3.98,
        })
        .expect(201);
      demandeId = (createRes.body as { id: string }).id;
    }, 15000);

    afterAll(async () => {
      await prisma.utilisateur.deleteMany({
        where: { telephone: OBSERVATEUR_PHONE },
      });
    });

    it('GET /demandes flags dejaRejoint true for the createur', async () => {
      const res = await request(app.getHttpServer())
        .get('/demandes')
        .set('Authorization', `Bearer ${etudiantToken}`)
        .query({ universiteId, communeId })
        .expect(200);
      const body = res.body as { id: string; dejaRejoint: boolean }[];
      const mine = body.find((d) => d.id === demandeId);
      expect(mine?.dejaRejoint).toBe(true);
    });

    it('GET /demandes/:id is viewable by a non-participant, with estParticipant false', async () => {
      const res = await request(app.getHttpServer())
        .get(`/demandes/${demandeId}`)
        .set('Authorization', `Bearer ${observateurToken}`)
        .expect(200);
      expect((res.body as { estParticipant: boolean }).estParticipant).toBe(
        false,
      );
    });

    it('POST /demandes/:id/annuler returns 403 for a non-createur', async () => {
      await request(app.getHttpServer())
        .post(`/demandes/${demandeId}/annuler`)
        .set('Authorization', `Bearer ${observateurToken}`)
        .expect(403);
    });

    it('POST /demandes/:id/annuler lets the createur cancel an open demande, then rejects further cancellation', async () => {
      await request(app.getHttpServer())
        .post(`/demandes/${demandeId}/annuler`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(201);

      const demande = await prisma.demande.findUniqueOrThrow({
        where: { id: demandeId },
      });
      expect(demande.statut).toBe('annulee');

      await request(app.getHttpServer())
        .post(`/demandes/${demandeId}/annuler`)
        .set('Authorization', `Bearer ${etudiantToken}`)
        .expect(409);
    });
  });
});
