import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // front_web (Vite, port different du backend) et un futur domaine de prod
  // ont besoin du cross-origin ; pas de cookies/session ici (auth par Bearer
  // token), donc une politique large ne cree pas de risque CSRF.
  app.enableCors();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('CampusRide API')
    .setDescription(
      'Contrat API du back CampusRide, consomme par front_mobile et front_web (AD-5, aucun code partage entre les repos)',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
