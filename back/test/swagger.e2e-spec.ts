import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Swagger (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    const swaggerConfig = new DocumentBuilder()
      .setTitle('CampusRide API')
      .setDescription('CampusRide API contract')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, swaggerDocument);

    await app.init();
  });

  afterAll(async () => {
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

  it('GET /api-json exposes an OpenAPI document with all Auth and Users paths', async () => {
    const res = await request(app.getHttpServer()).get('/api-json').expect(200);

    const document = res.body as {
      paths: Record<string, unknown>;
      components: { securitySchemes?: Record<string, unknown> };
    };

    const expectedPaths = [
      '/auth/otp/request',
      '/auth/otp/verify',
      '/auth/admin/login',
      '/users/me',
      '/users/me/conducteur',
      '/users/conducteurs/demandes',
      '/users/conducteurs/demandes/{id}/documents/{type}',
      '/users/conducteurs/demandes/{id}/valider',
      '/users/conducteurs/demandes/{id}/refuser',
    ];
    for (const path of expectedPaths) {
      expect(document.paths).toHaveProperty(path);
    }

    expect(document.components.securitySchemes).toHaveProperty('access-token');
  });
});
