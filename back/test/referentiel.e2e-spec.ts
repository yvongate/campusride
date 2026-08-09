import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import bcryptjs from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

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

describe('Referentiel Universites (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let etudiantToken: string;

  const ADMIN_EMAIL = 'admin-referentiel-e2e@campusride.ci';
  const ADMIN_PASSWORD = 'un-mot-de-passe-suffisamment-long';
  const ETUDIANT_PHONE = '+2250700000050';

  async function cleanup() {
    await prisma.utilisateur.deleteMany({ where: { email: ADMIN_EMAIL } });
    await prisma.utilisateur.deleteMany({
      where: { telephone: ETUDIANT_PHONE },
    });
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

    await cleanup();

    const passwordHash = await bcryptjs.hash(ADMIN_PASSWORD, 12);
    await prisma.utilisateur.create({
      data: { email: ADMIN_EMAIL, passwordHash, role: 'admin' },
    });
    const loginRes = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    adminToken = (loginRes.body as { accessToken: string }).accessToken;

    const code = await requestOtpAndGetCode(app, ETUDIANT_PHONE);
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone: ETUDIANT_PHONE, code })
      .expect(200);
    etudiantToken = (verifyRes.body as { accessToken: string }).accessToken;
  }, 15000);

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

  it('POST /referentiel/universites returns 401 without a token', async () => {
    await request(app.getHttpServer())
      .post('/referentiel/universites')
      .send({
        nom: 'E2E Sans Token',
        commune: 'Cocody',
        latitude: 5.34,
        longitude: -3.99,
      })
      .expect(401);
  });

  it('POST /referentiel/universites returns 403 for a non-admin token', async () => {
    await request(app.getHttpServer())
      .post('/referentiel/universites')
      .set('Authorization', `Bearer ${etudiantToken}`)
      .send({
        nom: 'E2E Etudiant',
        commune: 'Cocody',
        latitude: 5.34,
        longitude: -3.99,
      })
      .expect(403);
  });

  it('GET /referentiel/universites returns 200 for an authenticated non-admin user', async () => {
    await request(app.getHttpServer())
      .get('/referentiel/universites')
      .set('Authorization', `Bearer ${etudiantToken}`)
      .expect(200);
  });

  it('GET /referentiel/universites returns 401 without a token', async () => {
    await request(app.getHttpServer())
      .get('/referentiel/universites')
      .expect(401);
  });

  it('creates then updates a universite as admin', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/referentiel/universites')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nom: 'E2E FHB Cocody',
        commune: 'Cocody',
        latitude: 5.34,
        longitude: -3.99,
      })
      .expect(201);

    const universiteId = (createRes.body as { id: string }).id;

    const listRes = await request(app.getHttpServer())
      .get('/referentiel/universites')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(listRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: universiteId, nom: 'E2E FHB Cocody' }),
      ]),
    );

    await request(app.getHttpServer())
      .patch(`/referentiel/universites/${universiteId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commune: 'Cocody-modifie' })
      .expect(200);

    const updated = await prisma.universite.findUniqueOrThrow({
      where: { id: universiteId },
    });
    expect(updated.commune).toBe('Cocody-modifie');
    expect(updated.nom).toBe('E2E FHB Cocody');
  });

  it('PATCH /referentiel/universites/:id returns 404 for an unknown id', async () => {
    await request(app.getHttpServer())
      .patch('/referentiel/universites/does-not-exist')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'Peu importe' })
      .expect(404);
  });
});

describe('Referentiel Communes et Quartiers (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let etudiantToken: string;

  const ADMIN_EMAIL = 'admin-communes-e2e@campusride.ci';
  const ADMIN_PASSWORD = 'un-mot-de-passe-suffisamment-long';
  const ETUDIANT_PHONE = '+2250700000051';

  async function cleanup() {
    await prisma.utilisateur.deleteMany({ where: { email: ADMIN_EMAIL } });
    await prisma.utilisateur.deleteMany({
      where: { telephone: ETUDIANT_PHONE },
    });
    await prisma.quartier.deleteMany({
      where: { nom: { startsWith: 'E2E ' } },
    });
    await prisma.commune.deleteMany({ where: { nom: { startsWith: 'E2E ' } } });
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

    await cleanup();

    const passwordHash = await bcryptjs.hash(ADMIN_PASSWORD, 12);
    await prisma.utilisateur.create({
      data: { email: ADMIN_EMAIL, passwordHash, role: 'admin' },
    });
    const loginRes = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    adminToken = (loginRes.body as { accessToken: string }).accessToken;

    const code = await requestOtpAndGetCode(app, ETUDIANT_PHONE);
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone: ETUDIANT_PHONE, code })
      .expect(200);
    etudiantToken = (verifyRes.body as { accessToken: string }).accessToken;
  }, 15000);

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

  it('POST /referentiel/communes returns 403 for a non-admin token', async () => {
    await request(app.getHttpServer())
      .post('/referentiel/communes')
      .set('Authorization', `Bearer ${etudiantToken}`)
      .send({ nom: 'E2E Cocody', ville: 'Abidjan' })
      .expect(403);
  });

  it('POST /referentiel/quartiers returns 400 when the communeId does not exist', async () => {
    await request(app.getHttpServer())
      .post('/referentiel/quartiers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'E2E Angre', communeId: 'does-not-exist' })
      .expect(400);
  });

  it('creates communes and quartiers, and filters quartiers by commune', async () => {
    const communeARes = await request(app.getHttpServer())
      .post('/referentiel/communes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'E2E Cocody', ville: 'Abidjan' })
      .expect(201);
    const communeBRes = await request(app.getHttpServer())
      .post('/referentiel/communes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'E2E Yopougon', ville: 'Abidjan' })
      .expect(201);
    const communeAId = (communeARes.body as { id: string }).id;
    const communeBId = (communeBRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .post('/referentiel/quartiers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'E2E Angre', communeId: communeAId })
      .expect(201);
    await request(app.getHttpServer())
      .post('/referentiel/quartiers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'E2E Selmer', communeId: communeBId })
      .expect(201);

    const allQuartiersRes = await request(app.getHttpServer())
      .get('/referentiel/quartiers')
      .set('Authorization', `Bearer ${etudiantToken}`)
      .expect(200);
    const allNames = (allQuartiersRes.body as { nom: string }[]).map(
      (q) => q.nom,
    );
    expect(allNames).toEqual(
      expect.arrayContaining(['E2E Angre', 'E2E Selmer']),
    );

    const filteredRes = await request(app.getHttpServer())
      .get('/referentiel/quartiers')
      .query({ communeId: communeAId })
      .set('Authorization', `Bearer ${etudiantToken}`)
      .expect(200);
    const filtered = filteredRes.body as { nom: string; communeId: string }[];
    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({
      nom: 'E2E Angre',
      communeId: communeAId,
    });
  });
});

describe("Referentiel Points d'Interet (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let etudiantToken: string;
  let communeId: string;
  let quartierAId: string;
  let quartierBId: string;

  const ADMIN_EMAIL = 'admin-poi-e2e@campusride.ci';
  const ADMIN_PASSWORD = 'un-mot-de-passe-suffisamment-long';
  const ETUDIANT_PHONE = '+2250700000052';

  async function cleanup() {
    await prisma.utilisateur.deleteMany({ where: { email: ADMIN_EMAIL } });
    await prisma.utilisateur.deleteMany({
      where: { telephone: ETUDIANT_PHONE },
    });
    await prisma.pointInteret.deleteMany({
      where: { nom: { startsWith: 'E2E ' } },
    });
    await prisma.quartier.deleteMany({
      where: { nom: { startsWith: 'E2E ' } },
    });
    await prisma.commune.deleteMany({ where: { nom: { startsWith: 'E2E ' } } });
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

    await cleanup();

    const passwordHash = await bcryptjs.hash(ADMIN_PASSWORD, 12);
    await prisma.utilisateur.create({
      data: { email: ADMIN_EMAIL, passwordHash, role: 'admin' },
    });
    const loginRes = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    adminToken = (loginRes.body as { accessToken: string }).accessToken;

    const code = await requestOtpAndGetCode(app, ETUDIANT_PHONE);
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone: ETUDIANT_PHONE, code })
      .expect(200);
    etudiantToken = (verifyRes.body as { accessToken: string }).accessToken;

    const commune = await prisma.commune.create({
      data: { nom: 'E2E Cocody', ville: 'Abidjan' },
    });
    communeId = commune.id;
    const quartierA = await prisma.quartier.create({
      data: { nom: 'E2E Angre', communeId },
    });
    quartierAId = quartierA.id;
    const quartierB = await prisma.quartier.create({
      data: { nom: 'E2E Riviera', communeId },
    });
    quartierBId = quartierB.id;
  }, 15000);

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

  it('POST /referentiel/points-interet returns 401 without a token', async () => {
    await request(app.getHttpServer())
      .post('/referentiel/points-interet')
      .send({
        nom: 'E2E Carrefour',
        type: 'carrefour',
        quartierId: quartierAId,
        latitude: 5.36,
        longitude: -3.98,
      })
      .expect(401);
  });

  it('POST /referentiel/points-interet returns 403 for a non-admin token', async () => {
    await request(app.getHttpServer())
      .post('/referentiel/points-interet')
      .set('Authorization', `Bearer ${etudiantToken}`)
      .send({
        nom: 'E2E Carrefour',
        type: 'carrefour',
        quartierId: quartierAId,
        latitude: 5.36,
        longitude: -3.98,
      })
      .expect(403);
  });

  it('POST /referentiel/points-interet returns 400 when the quartierId does not exist', async () => {
    await request(app.getHttpServer())
      .post('/referentiel/points-interet')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nom: 'E2E Carrefour',
        type: 'carrefour',
        quartierId: 'does-not-exist',
        latitude: 5.36,
        longitude: -3.98,
      })
      .expect(400);
  });

  it('creates points interet and filters them by quartier', async () => {
    await request(app.getHttpServer())
      .post('/referentiel/points-interet')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nom: 'E2E Carrefour Angre',
        type: 'carrefour',
        quartierId: quartierAId,
        latitude: 5.36,
        longitude: -3.98,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/referentiel/points-interet')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nom: 'E2E Marche Riviera',
        type: 'marche',
        quartierId: quartierBId,
        latitude: 5.37,
        longitude: -3.97,
      })
      .expect(201);

    const allRes = await request(app.getHttpServer())
      .get('/referentiel/points-interet')
      .set('Authorization', `Bearer ${etudiantToken}`)
      .expect(200);
    const allNames = (allRes.body as { nom: string }[]).map((p) => p.nom);
    expect(allNames).toEqual(
      expect.arrayContaining(['E2E Carrefour Angre', 'E2E Marche Riviera']),
    );

    const filteredRes = await request(app.getHttpServer())
      .get('/referentiel/points-interet')
      .query({ quartierId: quartierAId })
      .set('Authorization', `Bearer ${etudiantToken}`)
      .expect(200);
    const filtered = filteredRes.body as {
      nom: string;
      quartierId: string;
      quartier: { commune: { nom: string } };
    }[];
    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({
      nom: 'E2E Carrefour Angre',
      quartierId: quartierAId,
    });
    expect(filtered[0].quartier.commune.nom).toBe('E2E Cocody');
  });
});
