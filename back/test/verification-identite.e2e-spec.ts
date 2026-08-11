import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SchedulerRegistry } from '@nestjs/schedule';
import { unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { IDENTITE_UPLOADS_DIR } from '../src/users/identite-files.storage';
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

const TINY_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9,
]);

describe('Verification d’identite (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;

  const TEST_PHONE = '+2250700000100';

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

    await prisma.verificationIdentite.deleteMany({
      where: { utilisateur: { telephone: TEST_PHONE } },
    });
    await prisma.utilisateur.deleteMany({ where: { telephone: TEST_PHONE } });

    const code = await requestOtpAndGetCode(app, TEST_PHONE);
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone: TEST_PHONE, code })
      .expect(200);
    token = (verifyRes.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await prisma.verificationIdentite.deleteMany({
      where: { utilisateur: { telephone: TEST_PHONE } },
    });
    await prisma.utilisateur.deleteMany({ where: { telephone: TEST_PHONE } });
    app
      .get(SchedulerRegistry)
      .getCronJobs()
      .forEach((job) => {
        void job.stop();
      });
    await app.close();
  });

  it('POST /users/me/verification returns 401 without a token', async () => {
    await request(app.getHttpServer())
      .post('/users/me/verification')
      .field('placeholder', '1')
      .attach('cni', TINY_JPEG, 'cni.jpg')
      .attach('selfie', TINY_JPEG, 'selfie.jpg')
      .expect(401);
  });

  it('creates a pending verification, then rejects a second one with 409', async () => {
    await request(app.getHttpServer())
      .post('/users/me/verification')
      .set('Authorization', `Bearer ${token}`)
      .attach('cni', TINY_JPEG, 'cni.jpg')
      .attach('selfie', TINY_JPEG, 'selfie.jpg')
      .expect(201);

    const meRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      (meRes.body as { verificationStatut: string }).verificationStatut,
    ).toBe('en attente');

    await request(app.getHttpServer())
      .post('/users/me/verification')
      .set('Authorization', `Bearer ${token}`)
      .attach('cni', TINY_JPEG, 'cni.jpg')
      .attach('selfie', TINY_JPEG, 'selfie.jpg')
      .expect(409);
  });
});

describe('Validation admin de la verification d’identite (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let etudiantToken: string;
  let candidatId: string;

  const ADMIN_PHONE = '+2250700000101';
  const CANDIDAT_PHONE = '+2250700000102';
  const CNI_FILENAME = 'e2e-verification-cni.jpg';
  const SELFIE_FILENAME = 'e2e-verification-selfie.jpg';

  async function cleanup() {
    await prisma.verificationIdentite.deleteMany({
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

    // Meme raisonnement que users.e2e-spec.ts (Validation admin du compte
    // conducteur) : JwtStrategy ne verifie que la signature/le payload, pas
    // la provenance -- signature directe d'un token admin plutot qu'un
    // login complet, superflu pour ce test.
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

    writeFileSync(join(IDENTITE_UPLOADS_DIR, CNI_FILENAME), TINY_JPEG);
    writeFileSync(join(IDENTITE_UPLOADS_DIR, SELFIE_FILENAME), TINY_JPEG);
  });

  afterAll(async () => {
    await cleanup();
    try {
      unlinkSync(join(IDENTITE_UPLOADS_DIR, CNI_FILENAME));
      unlinkSync(join(IDENTITE_UPLOADS_DIR, SELFIE_FILENAME));
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

  it('GET /users/verifications returns 401 without a token', async () => {
    await request(app.getHttpServer())
      .get('/users/verifications')
      .expect(401);
  });

  it('GET /users/verifications returns 403 for a non-admin token', async () => {
    await request(app.getHttpServer())
      .get('/users/verifications')
      .set('Authorization', `Bearer ${etudiantToken}`)
      .expect(403);
  });

  it('lists a pending verification, serves its documents, then validates it', async () => {
    const verification = await prisma.verificationIdentite.create({
      data: {
        userId: candidatId,
        cni: CNI_FILENAME,
        selfie: SELFIE_FILENAME,
      },
    });

    const listRes = await request(app.getHttpServer())
      .get('/users/verifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(listRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: verification.id,
          telephone: CANDIDAT_PHONE,
          statut: 'en attente',
        }),
      ]),
    );

    const cniRes = await request(app.getHttpServer())
      .get(`/users/verifications/${verification.id}/documents/cni`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(cniRes.headers['content-type']).toContain('image/jpeg');

    await request(app.getHttpServer())
      .get(`/users/verifications/${verification.id}/documents/cni`)
      .set('Authorization', `Bearer ${etudiantToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/users/verifications/${verification.id}/documents/passeport`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/users/verifications/${verification.id}/valider`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const updated = await prisma.verificationIdentite.findUniqueOrThrow({
      where: { id: verification.id },
    });
    expect(updated.statut).toBe('valide');

    await request(app.getHttpServer())
      .patch(`/users/verifications/${verification.id}/valider`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
  });

  it('refuses a pending verification', async () => {
    const verification = await prisma.verificationIdentite.create({
      data: {
        userId: candidatId,
        cni: CNI_FILENAME,
        selfie: SELFIE_FILENAME,
      },
    });

    await request(app.getHttpServer())
      .patch(`/users/verifications/${verification.id}/refuser`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const updated = await prisma.verificationIdentite.findUniqueOrThrow({
      where: { id: verification.id },
    });
    expect(updated.statut).toBe('refuse');

    await request(app.getHttpServer())
      .patch(`/users/verifications/${verification.id}/refuser`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
  });

  it('PATCH .../valider returns 404 for an unknown verification id', async () => {
    await request(app.getHttpServer())
      .patch('/users/verifications/does-not-exist/valider')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
