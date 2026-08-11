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

describe('Statistiques (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let conducteurToken: string;
  let etudiantToken: string;
  let candidatConducteurToken: string;
  let universiteId: string;
  let communeId: string;
  let pointDeRdvId: string;

  const ADMIN_EMAIL = 'admin-statistiques-e2e@campusride.ci';
  const ADMIN_PASSWORD = 'un-mot-de-passe-suffisamment-long';
  const CONDUCTEUR_PHONE = '+2250700000095';
  const ETUDIANT_PHONE = '+2250700000096';
  const CANDIDAT_CONDUCTEUR_PHONE = '+2250700000097';
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
    await prisma.participation.deleteMany({
      where: { utilisateur: { telephone: ETUDIANT_PHONE } },
    });
    await prisma.demande.deleteMany({
      where: { createur: { telephone: ETUDIANT_PHONE } },
    });
    await prisma.documentsConducteur.deleteMany({
      where: {
        utilisateur: {
          telephone: { in: [CONDUCTEUR_PHONE, CANDIDAT_CONDUCTEUR_PHONE] },
        },
      },
    });
    await prisma.utilisateur.deleteMany({ where: { email: ADMIN_EMAIL } });
    await prisma.utilisateur.deleteMany({
      where: {
        telephone: {
          in: [CONDUCTEUR_PHONE, ETUDIANT_PHONE, CANDIDAT_CONDUCTEUR_PHONE],
        },
      },
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
    await request(app.getHttpServer())
      .post('/users/me/conducteur')
      .set('Authorization', `Bearer ${conducteurToken}`)
      .field('matriculeVehicule', 'CI-2847-AB')
      .attach('selfie', TINY_JPEG, 'selfie.jpg')
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

    // Candidat conducteur laisse volontairement "en attente" (jamais valide)
    code = await requestOtpAndGetCode(app, CANDIDAT_CONDUCTEUR_PHONE);
    const candidatVerifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone: CANDIDAT_CONDUCTEUR_PHONE, code })
      .expect(200);
    candidatConducteurToken = (
      candidatVerifyRes.body as { accessToken: string }
    ).accessToken;
    await request(app.getHttpServer())
      .post('/users/me/conducteur')
      .set('Authorization', `Bearer ${candidatConducteurToken}`)
      .field('matriculeVehicule', 'CI-1111-ZZ')
      .attach('selfie', TINY_JPEG, 'selfie.jpg')
      .attach('permis', TINY_JPEG, 'permis.jpg')
      .expect(201);
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
    await request(app.getHttpServer()).get('/admin/statistiques').expect(401);
    await request(app.getHttpServer())
      .get('/admin/statistiques')
      .set('Authorization', `Bearer ${etudiantToken}`)
      .expect(403);
  });

  it('reflects trajets today, demandes en attente, conducteurs a valider and signalements ouverts', async () => {
    // Trajet aujourd'hui
    const aujourdhuiMidi = new Date();
    aujourdhuiMidi.setUTCHours(12, 0, 0, 0);
    const createTrajetRes = await request(app.getHttpServer())
      .post('/trajets')
      .set('Authorization', `Bearer ${conducteurToken}`)
      .send({
        universiteId,
        pointDeRdvId,
        heure: aujourdhuiMidi.toISOString(),
        places: 2,
        prixTotal: 2000,
      })
      .expect(201);
    const trajetId = (createTrajetRes.body as { id: string }).id;

    // Demande ouverte (quota non atteint)
    await request(app.getHttpServer())
      .post('/demandes')
      .set('Authorization', `Bearer ${etudiantToken}`)
      .send({
        universiteId,
        communeId,
        heure: '2026-09-21T07:00:00.000Z',
        placesRecherchees: 4,
        cotisation: 500,
        chezMoi: true,
        lat: 5.36,
        lng: -3.98,
      })
      .expect(201);

    // Signalement reel (no-show passager)
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

    const res = await request(app.getHttpServer())
      .get('/admin/statistiques')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const stats = res.body as {
      trajetsAujourdhui: number;
      demandesEnAttente: number;
      conducteursAValider: number;
      signalementsOuverts: number;
    };
    expect(stats.trajetsAujourdhui).toBeGreaterThanOrEqual(1);
    expect(stats.demandesEnAttente).toBeGreaterThanOrEqual(1);
    expect(stats.conducteursAValider).toBeGreaterThanOrEqual(1);
    expect(stats.signalementsOuverts).toBeGreaterThanOrEqual(1);
  }, 15000);
});
