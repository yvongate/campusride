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

describe('Signalements (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let conducteurToken: string;
  let etudiantToken: string;
  let universiteId: string;
  let pointDeRdvId: string;

  const ADMIN_EMAIL = 'admin-signalements-e2e@campusride.ci';
  const ADMIN_PASSWORD = 'un-mot-de-passe-suffisamment-long';
  const CONDUCTEUR_PHONE = '+2250700000098';
  const ETUDIANT_PHONE = '+2250700000099';
  const TINY_JPEG = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9,
  ]);

  async function cleanup() {
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
    app
      .get(SchedulerRegistry)
      .getCronJobs()
      .forEach((job) => {
        void job.stop();
      });
    await app.close();
  });

  it('returns 401 without a token and 403 for a non-admin', async () => {
    await request(app.getHttpServer()).get('/admin/signalements').expect(401);
    await request(app.getHttpServer())
      .get('/admin/signalements')
      .set('Authorization', `Bearer ${etudiantToken}`)
      .expect(403);
  });

  it('lists a real signalement and lets the admin mark it as "traite"', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/trajets')
      .set('Authorization', `Bearer ${conducteurToken}`)
      .send({
        universiteId,
        pointDeRdvId,
        heure: '2026-09-22T07:00:00.000Z',
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
      .patch(`/trajets/${trajetId}/demarrer`)
      .set('Authorization', `Bearer ${conducteurToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/trajets/${trajetId}/terminer`)
      .set('Authorization', `Bearer ${conducteurToken}`)
      .expect(200);
    const etudiant = await prisma.utilisateur.findUniqueOrThrow({
      where: { telephone: ETUDIANT_PHONE },
    });
    await request(app.getHttpServer())
      .patch(`/trajets/${trajetId}/passagers/${etudiant.id}/signaler-absence`)
      .set('Authorization', `Bearer ${conducteurToken}`)
      .expect(200);

    const listRes = await request(app.getHttpServer())
      .get('/admin/signalements')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const signalements = listRes.body as {
      id: string;
      type: string;
      statut: string;
      concerne: { id: string };
    }[];
    const signalement = signalements.find(
      (s) => s.type === 'no_show_passager' && s.concerne.id === etudiant.id,
    );
    expect(signalement).toBeDefined();
    expect(signalement?.statut).toBe('ouvert');

    await request(app.getHttpServer())
      .patch(`/admin/signalements/${signalement?.id}/traiter`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const signalementApres = await prisma.signalement.findUniqueOrThrow({
      where: { id: signalement?.id },
    });
    expect(signalementApres.statut).toBe('traite');

    // Deja traite -> 409
    await request(app.getHttpServer())
      .patch(`/admin/signalements/${signalement?.id}/traiter`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
  }, 15000);

  it('returns 404 when the signalement does not exist', async () => {
    await request(app.getHttpServer())
      .patch('/admin/signalements/does-not-exist/traiter')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
