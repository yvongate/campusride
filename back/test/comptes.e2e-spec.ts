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

describe('Comptes (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let adminId: string;
  let etudiantToken: string;
  let etudiantId: string;

  const ADMIN_EMAIL = 'admin-comptes-e2e@campusride.ci';
  const ADMIN_PASSWORD = 'un-mot-de-passe-suffisamment-long';
  const PHONE = '+2250700000199';

  async function cleanup() {
    await prisma.utilisateur.deleteMany({ where: { email: ADMIN_EMAIL } });
    await prisma.utilisateur.deleteMany({ where: { telephone: PHONE } });
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
    const admin = await prisma.utilisateur.create({
      data: { email: ADMIN_EMAIL, passwordHash, role: 'admin' },
    });
    adminId = admin.id;
    const adminLoginRes = await request(app.getHttpServer())
      .post('/auth/admin/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    adminToken = (adminLoginRes.body as { accessToken: string }).accessToken;

    const code = await requestOtpAndGetCode(app, PHONE);
    const etudiantVerifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone: PHONE, code })
      .expect(200);
    etudiantToken = (etudiantVerifyRes.body as { accessToken: string })
      .accessToken;
    const etudiant = await prisma.utilisateur.findUniqueOrThrow({
      where: { telephone: PHONE },
    });
    etudiantId = etudiant.id;
  }, 30000);

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

  it('returns 401 without a token and 403 for a non-admin', async () => {
    await request(app.getHttpServer()).get('/admin/utilisateurs').expect(401);
    await request(app.getHttpServer())
      .get('/admin/utilisateurs')
      .set('Authorization', `Bearer ${etudiantToken}`)
      .expect(403);
  });

  it('lists etudiant/conducteur accounts but excludes admin accounts', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/utilisateurs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const comptes = res.body as { id: string; role: string }[];

    expect(comptes.some((c) => c.id === etudiantId)).toBe(true);
    expect(comptes.some((c) => c.id === adminId)).toBe(false);
  });

  it('deactivates then reactivates an etudiant account', async () => {
    await request(app.getHttpServer())
      .patch(`/admin/utilisateurs/${etudiantId}/desactiver`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const apresDesactivation = await prisma.utilisateur.findUniqueOrThrow({
      where: { id: etudiantId },
    });
    expect(apresDesactivation.actif).toBe(false);

    await request(app.getHttpServer())
      .patch(`/admin/utilisateurs/${etudiantId}/reactiver`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const apresReactivation = await prisma.utilisateur.findUniqueOrThrow({
      where: { id: etudiantId },
    });
    expect(apresReactivation.actif).toBe(true);
  });

  it('rejects targeting an admin account with 400', async () => {
    await request(app.getHttpServer())
      .patch(`/admin/utilisateurs/${adminId}/desactiver`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('returns 404 for a compte that does not exist', async () => {
    await request(app.getHttpServer())
      .patch('/admin/utilisateurs/does-not-exist/desactiver')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
