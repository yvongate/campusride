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

describe('Notation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let conducteurToken: string;
  let etudiantToken: string;
  let tiersToken: string;
  let universiteId: string;
  let pointDeRdvId: string;

  const ADMIN_EMAIL = 'admin-notation-e2e@campusride.ci';
  const ADMIN_PASSWORD = 'un-mot-de-passe-suffisamment-long';
  const CONDUCTEUR_PHONE = '+2250700000090';
  const ETUDIANT_PHONE = '+2250700000091';
  const TIERS_PHONE = '+2250700000092';
  const TINY_JPEG = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9,
  ]);

  async function cleanup() {
    await prisma.notation.deleteMany({
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
    await prisma.utilisateur.deleteMany({ where: { email: ADMIN_EMAIL } });
    await prisma.utilisateur.deleteMany({
      where: {
        telephone: { in: [CONDUCTEUR_PHONE, ETUDIANT_PHONE, TIERS_PHONE] },
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

    code = await requestOtpAndGetCode(app, TIERS_PHONE);
    const tiersVerifyRes = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone: TIERS_PHONE, code })
      .expect(200);
    tiersToken = (tiersVerifyRes.body as { accessToken: string }).accessToken;
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

  async function creerEtTerminerTrajet(heure: string): Promise<string> {
    const createRes = await request(app.getHttpServer())
      .post('/trajets')
      .set('Authorization', `Bearer ${conducteurToken}`)
      .send({ universiteId, pointDeRdvId, heure, places: 2, prixTotal: 2000 })
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

    return trajetId;
  }

  it('lets the conducteur and passager rate each other, recalculating the average note', async () => {
    const etudiant = await prisma.utilisateur.findUniqueOrThrow({
      where: { telephone: ETUDIANT_PHONE },
    });
    const conducteur = await prisma.utilisateur.findUniqueOrThrow({
      where: { telephone: CONDUCTEUR_PHONE },
    });

    const trajetId = await creerEtTerminerTrajet('2026-09-18T07:00:00.000Z');

    await request(app.getHttpServer())
      .post(`/trajets/${trajetId}/notations`)
      .set('Authorization', `Bearer ${conducteurToken}`)
      .send({ destinataireId: etudiant.id, etoiles: 5, commentaire: 'Nickel' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/trajets/${trajetId}/notations`)
      .set('Authorization', `Bearer ${etudiantToken}`)
      .send({ destinataireId: conducteur.id, etoiles: 4 })
      .expect(201);

    const etudiantApres = await prisma.utilisateur.findUniqueOrThrow({
      where: { id: etudiant.id },
    });
    expect(etudiantApres.note).toBe(5);
    const conducteurApres = await prisma.utilisateur.findUniqueOrThrow({
      where: { id: conducteur.id },
    });
    expect(conducteurApres.note).toBe(4);

    // Deuxieme trajet -> deuxieme notation du meme destinataire -> moyenne
    const trajetId2 = await creerEtTerminerTrajet('2026-09-19T07:00:00.000Z');
    await request(app.getHttpServer())
      .post(`/trajets/${trajetId2}/notations`)
      .set('Authorization', `Bearer ${conducteurToken}`)
      .send({ destinataireId: etudiant.id, etoiles: 3 })
      .expect(201);

    const etudiantApres2 = await prisma.utilisateur.findUniqueOrThrow({
      where: { id: etudiant.id },
    });
    expect(etudiantApres2.note).toBe(4); // (5 + 3) / 2

    const notationsRes = await request(app.getHttpServer())
      .get(`/trajets/${trajetId}/notations`)
      .set('Authorization', `Bearer ${conducteurToken}`)
      .expect(200);
    expect((notationsRes.body as unknown[]).length).toBe(2);
  }, 15000);

  it('rejects self-rating, duplicate rating, rating before "termine", and non-participants', async () => {
    const etudiant = await prisma.utilisateur.findUniqueOrThrow({
      where: { telephone: ETUDIANT_PHONE },
    });
    const conducteur = await prisma.utilisateur.findUniqueOrThrow({
      where: { telephone: CONDUCTEUR_PHONE },
    });

    const createRes = await request(app.getHttpServer())
      .post('/trajets')
      .set('Authorization', `Bearer ${conducteurToken}`)
      .send({
        universiteId,
        pointDeRdvId,
        heure: '2026-09-20T07:00:00.000Z',
        places: 2,
        prixTotal: 2000,
      })
      .expect(201);
    const trajetId = (createRes.body as { id: string }).id;

    // Trop tot -- trajet pas encore "termine" (verifie avant l'auto-notation
    // dans le service, voir Story 6.3 Dev Notes -- ordre des verifications)
    await request(app.getHttpServer())
      .post(`/trajets/${trajetId}/notations`)
      .set('Authorization', `Bearer ${conducteurToken}`)
      .send({ destinataireId: etudiant.id, etoiles: 5 })
      .expect(409);

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

    // Auto-notation, sur le trajet desormais "termine"
    await request(app.getHttpServer())
      .post(`/trajets/${trajetId}/notations`)
      .set('Authorization', `Bearer ${conducteurToken}`)
      .send({ destinataireId: conducteur.id, etoiles: 5 })
      .expect(400);

    // Non-participant
    await request(app.getHttpServer())
      .post(`/trajets/${trajetId}/notations`)
      .set('Authorization', `Bearer ${tiersToken}`)
      .send({ destinataireId: etudiant.id, etoiles: 5 })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/trajets/${trajetId}/notations`)
      .set('Authorization', `Bearer ${conducteurToken}`)
      .send({ destinataireId: etudiant.id, etoiles: 5 })
      .expect(201);

    // Double notation du meme destinataire
    await request(app.getHttpServer())
      .post(`/trajets/${trajetId}/notations`)
      .set('Authorization', `Bearer ${conducteurToken}`)
      .send({ destinataireId: etudiant.id, etoiles: 2 })
      .expect(409);
  }, 15000);
});
