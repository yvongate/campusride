import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SchedulerRegistry } from '@nestjs/schedule';
import { unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { CONDUCTEUR_UPLOADS_DIR } from '../src/users/conducteur-files.storage';
import { PrismaService } from '../src/prisma/prisma.service';

const TEST_PHONE = '+2250700000020';

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

describe('Users (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

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
    await prisma.utilisateur.deleteMany({ where: { telephone: TEST_PHONE } });
  });

  afterAll(async () => {
    await prisma.utilisateur.deleteMany({ where: { telephone: TEST_PHONE } });
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

  it('GET /users/me returns 401 without a token', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('GET /users/me returns 401 with a garbage token', async () => {
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });

  it('GET /users/me returns the profile for a valid token', async () => {
    const code = await requestOtpAndGetCode(app, TEST_PHONE);

    const verifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone: TEST_PHONE, code })
      .expect(200);
    const token = (verifyRes.body as { accessToken: string }).accessToken;

    const res = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({
      telephone: TEST_PHONE,
      nom: null,
      prenom: null,
      note: null,
      conducteurStatut: null,
    });
  });
});

describe('Devenir conducteur (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;

  const CONDUCTEUR_TEST_PHONE = '+2250700000021';
  const TINY_JPEG = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9,
  ]);

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

    await prisma.documentsConducteur.deleteMany({
      where: { utilisateur: { telephone: CONDUCTEUR_TEST_PHONE } },
    });
    await prisma.utilisateur.deleteMany({
      where: { telephone: CONDUCTEUR_TEST_PHONE },
    });

    const code = await requestOtpAndGetCode(app, CONDUCTEUR_TEST_PHONE);
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone: CONDUCTEUR_TEST_PHONE, code })
      .expect(200);
    token = (verifyRes.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await prisma.documentsConducteur.deleteMany({
      where: { utilisateur: { telephone: CONDUCTEUR_TEST_PHONE } },
    });
    await prisma.utilisateur.deleteMany({
      where: { telephone: CONDUCTEUR_TEST_PHONE },
    });
    app
      .get(SchedulerRegistry)
      .getCronJobs()
      .forEach((job) => {
        void job.stop();
      });
    await app.close();
  });

  it('POST /users/me/conducteur returns 401 without a token', async () => {
    await request(app.getHttpServer())
      .post('/users/me/conducteur')
      .field('matriculeVehicule', 'CI-2847-AB')
      .attach('selfie', TINY_JPEG, 'selfie.jpg')
      .attach('permis', TINY_JPEG, 'permis.jpg')
      .expect(401);
  });

  it('POST /users/me/conducteur creates a pending request, then rejects a second one with 409', async () => {
    await request(app.getHttpServer())
      .post('/users/me/conducteur')
      .set('Authorization', `Bearer ${token}`)
      .field('matriculeVehicule', 'CI-2847-AB')
      .attach('selfie', TINY_JPEG, 'selfie.jpg')
      .attach('permis', TINY_JPEG, 'permis.jpg')
      .expect(201);

    const meRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((meRes.body as { conducteurStatut: string }).conducteurStatut).toBe(
      'en attente',
    );

    await request(app.getHttpServer())
      .post('/users/me/conducteur')
      .set('Authorization', `Bearer ${token}`)
      .field('matriculeVehicule', 'CI-2847-AB')
      .attach('selfie', TINY_JPEG, 'selfie.jpg')
      .attach('permis', TINY_JPEG, 'permis.jpg')
      .expect(409);
  });

  it('persists photoVehicule and motBienvenue when provided (Story 5.1)', async () => {
    // Flux OTP reel (request + verify) + upload multipart -- depasse le
    // timeout par defaut de 5000ms, meme pattern que le beforeAll principal.
    const rencontrePhone = '+2250700000029';
    await prisma.documentsConducteur.deleteMany({
      where: { utilisateur: { telephone: rencontrePhone } },
    });
    await prisma.utilisateur.deleteMany({
      where: { telephone: rencontrePhone },
    });

    const code = await requestOtpAndGetCode(app, rencontrePhone);
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone: rencontrePhone, code })
      .expect(200);
    const rencontreToken = (verifyRes.body as { accessToken: string })
      .accessToken;

    await request(app.getHttpServer())
      .post('/users/me/conducteur')
      .set('Authorization', `Bearer ${rencontreToken}`)
      .field('matriculeVehicule', 'CI-9999-ZZ')
      .field('motBienvenue', 'A bientot sur la route !')
      .attach('selfie', TINY_JPEG, 'selfie.jpg')
      .attach('permis', TINY_JPEG, 'permis.jpg')
      .attach('photoVehicule', TINY_JPEG, 'vehicule.jpg')
      .expect(201);

    const documents = await prisma.documentsConducteur.findFirstOrThrow({
      where: { utilisateur: { telephone: rencontrePhone } },
    });
    expect(documents.photoVehicule).toContain('.jpg');
    expect(documents.motBienvenue).toBe('A bientot sur la route !');

    await prisma.documentsConducteur.deleteMany({
      where: { utilisateur: { telephone: rencontrePhone } },
    });
    await prisma.utilisateur.deleteMany({
      where: { telephone: rencontrePhone },
    });
  }, 15000);
});

describe('Validation admin du compte conducteur (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let etudiantToken: string;
  let candidatId: string;

  const ADMIN_PHONE = '+2250700000030';
  const CANDIDAT_PHONE = '+2250700000031';
  const SELFIE_FILENAME = 'e2e-admin-test-selfie.jpg';
  const PERMIS_FILENAME = 'e2e-admin-test-permis.jpg';
  const TINY_JPEG = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9,
  ]);

  async function cleanup() {
    await prisma.documentsConducteur.deleteMany({
      where: {
        utilisateur: { telephone: { in: [ADMIN_PHONE, CANDIDAT_PHONE] } },
      },
    });
    await prisma.utilisateur.deleteMany({
      where: { telephone: { in: [ADMIN_PHONE, CANDIDAT_PHONE] } },
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
    jwtService = app.get(JwtService);

    await cleanup();

    // Story 1.6 (login admin) n'existe pas encore : JwtStrategy ne verifie que la
    // signature/le payload du JWT, jamais sa provenance, donc on signe directement
    // un token admin ici plutot que de simuler un flux de connexion inexistant.
    const admin = await prisma.utilisateur.create({
      data: { telephone: ADMIN_PHONE, role: 'admin' },
    });
    adminToken = jwtService.sign({ sub: admin.id, role: 'admin' });

    const code = await requestOtpAndGetCode(app, CANDIDAT_PHONE);
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone: CANDIDAT_PHONE, code })
      .expect(200);
    etudiantToken = (verifyRes.body as { accessToken: string }).accessToken;
    const candidat = await prisma.utilisateur.findUniqueOrThrow({
      where: { telephone: CANDIDAT_PHONE },
    });
    candidatId = candidat.id;

    writeFileSync(join(CONDUCTEUR_UPLOADS_DIR, SELFIE_FILENAME), TINY_JPEG);
    writeFileSync(join(CONDUCTEUR_UPLOADS_DIR, PERMIS_FILENAME), TINY_JPEG);
  });

  afterAll(async () => {
    await cleanup();
    try {
      unlinkSync(join(CONDUCTEUR_UPLOADS_DIR, SELFIE_FILENAME));
      unlinkSync(join(CONDUCTEUR_UPLOADS_DIR, PERMIS_FILENAME));
    } catch {
      // fichiers deja absents, rien a faire
    }
    app
      .get(SchedulerRegistry)
      .getCronJobs()
      .forEach((job) => {
        void job.stop();
      });
    await app.close();
  });

  it('GET /users/conducteurs/demandes returns 401 without a token', async () => {
    await request(app.getHttpServer())
      .get('/users/conducteurs/demandes')
      .expect(401);
  });

  it('GET /users/conducteurs/demandes returns 403 for a non-admin token', async () => {
    await request(app.getHttpServer())
      .get('/users/conducteurs/demandes')
      .set('Authorization', `Bearer ${etudiantToken}`)
      .expect(403);
  });

  it('lists a pending request, serves its documents, then validates it', async () => {
    const demande = await prisma.documentsConducteur.create({
      data: {
        userId: candidatId,
        selfie: SELFIE_FILENAME,
        photoPermis: PERMIS_FILENAME,
        matriculeVehicule: 'CI-2847-AB',
      },
    });

    const listRes = await request(app.getHttpServer())
      .get('/users/conducteurs/demandes')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(listRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: demande.id,
          telephone: CANDIDAT_PHONE,
          matriculeVehicule: 'CI-2847-AB',
          statut: 'en attente',
        }),
      ]),
    );

    const docRes = await request(app.getHttpServer())
      .get(`/users/conducteurs/demandes/${demande.id}/documents/selfie`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(docRes.headers['content-type']).toContain('image/jpeg');

    await request(app.getHttpServer())
      .get(`/users/conducteurs/demandes/${demande.id}/documents/selfie`)
      .set('Authorization', `Bearer ${etudiantToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/users/conducteurs/demandes/${demande.id}/documents/passeport`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/users/conducteurs/demandes/${demande.id}/valider`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const updatedUser = await prisma.utilisateur.findUniqueOrThrow({
      where: { id: candidatId },
    });
    expect(updatedUser.role).toBe('les deux');
    const updatedDemande = await prisma.documentsConducteur.findUniqueOrThrow({
      where: { id: demande.id },
    });
    expect(updatedDemande.statut).toBe('valide');

    await request(app.getHttpServer())
      .patch(`/users/conducteurs/demandes/${demande.id}/valider`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
  });

  it('refuses a pending request without changing the user role', async () => {
    const demande = await prisma.documentsConducteur.create({
      data: {
        userId: candidatId,
        selfie: SELFIE_FILENAME,
        photoPermis: PERMIS_FILENAME,
        matriculeVehicule: 'CI-1190-CD',
      },
    });

    await request(app.getHttpServer())
      .patch(`/users/conducteurs/demandes/${demande.id}/refuser`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const updatedDemande = await prisma.documentsConducteur.findUniqueOrThrow({
      where: { id: demande.id },
    });
    expect(updatedDemande.statut).toBe('refuse');

    await request(app.getHttpServer())
      .patch(`/users/conducteurs/demandes/${demande.id}/refuser`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
  });

  it('PATCH .../valider returns 404 for an unknown demande id', async () => {
    await request(app.getHttpServer())
      .patch('/users/conducteurs/demandes/does-not-exist/valider')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
