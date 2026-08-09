import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import bcryptjs from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const TEST_PHONES = [
  '+2250700000000',
  '+2250700000010',
  '+2250700000011',
  '+2250700000012',
];

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

interface VerifyOtpResponse {
  accessToken: string;
  user: { id: string; telephone: string; role: string };
}

describe('Auth (e2e)', () => {
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
    await prisma.utilisateur.deleteMany({
      where: { telephone: { in: TEST_PHONES } },
    });
  });

  afterAll(async () => {
    await prisma.utilisateur.deleteMany({
      where: { telephone: { in: TEST_PHONES } },
    });
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

  it('POST /auth/otp/request returns 200 and a 6-digit code for a valid phone number', async () => {
    const code = await requestOtpAndGetCode(app, TEST_PHONES[0]);

    expect(code).toMatch(/^\d{6}$/);
  });

  it('POST /auth/otp/request returns 400 for an invalid phone number', async () => {
    await request(app.getHttpServer())
      .post('/auth/otp/request')
      .send({ phone: '0700000000' })
      .expect(400);
  });

  it('POST /auth/otp/verify creates the user and returns a JWT for the correct code', async () => {
    const phone = TEST_PHONES[1];
    const code = await requestOtpAndGetCode(app, phone);

    const res = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone, code })
      .expect(200);

    const body = res.body as VerifyOtpResponse;
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.user).toMatchObject({ telephone: phone, role: 'etudiant' });

    const stored = await prisma.utilisateur.findUnique({
      where: { telephone: phone },
    });
    expect(stored).not.toBeNull();
  });

  it('POST /auth/otp/verify returns 401 for an incorrect code', async () => {
    const phone = TEST_PHONES[2];
    await requestOtpAndGetCode(app, phone);

    await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone, code: '000000' })
      .expect(401);
  });

  it('POST /auth/otp/verify returns 401 when no code was requested', async () => {
    await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone: TEST_PHONES[3], code: '123456' })
      .expect(401);
  });
});

describe('Login admin (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const ADMIN_EMAIL = 'admin-e2e-test@campusride.ci';
  const ADMIN_PASSWORD = 'un-mot-de-passe-suffisamment-long';
  const ETUDIANT_PHONE = '+2250700000040';
  // Un compte etudiant n'a normalement jamais d'email en pratique (flux OTP
  // uniquement) -- fixture defensive pour prouver que le garde-fou "pas de
  // passwordHash" fonctionne bout-en-bout, pas seulement dans le mock unitaire.
  const ETUDIANT_EMAIL = 'etudiant-sans-mdp@campusride.ci';

  async function cleanup() {
    await prisma.utilisateur.deleteMany({ where: { email: ADMIN_EMAIL } });
    await prisma.utilisateur.deleteMany({
      where: { telephone: ETUDIANT_PHONE },
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
    await prisma.utilisateur.create({
      data: {
        telephone: ETUDIANT_PHONE,
        email: ETUDIANT_EMAIL,
        role: 'etudiant',
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    app
      .get(SchedulerRegistry)
      .getCronJobs()
      .forEach((job) => {
        void job.stop();
      });
    await app.close();
  });

  it('logs the admin in and the resulting JWT works on a RolesGuard admin route', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);

    const accessToken = (res.body as { accessToken: string }).accessToken;
    expect(accessToken).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .get('/users/conducteurs/demandes')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('returns 401 with the same message for a wrong password', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ email: ADMIN_EMAIL, password: 'wrong-password' })
      .expect(401);
    expect((res.body as { message: string }).message).toBe(
      'Identifiants incorrects',
    );
  });

  it('returns 401 with the same message for an unknown email', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ email: 'nobody@campusride.ci', password: ADMIN_PASSWORD })
      .expect(401);
    expect((res.body as { message: string }).message).toBe(
      'Identifiants incorrects',
    );
  });

  it('returns 401 for an existing student account (no passwordHash)', async () => {
    await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ email: ETUDIANT_EMAIL, password: 'whatever1' })
      .expect(401);
  });
});
