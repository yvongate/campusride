import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DemandesModule } from './demandes/demandes.module';
import { MessagerieModule } from './messagerie/messagerie.module';
import { NotationModule } from './notation/notation.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReferentielModule } from './referentiel/referentiel.module';
import { StatistiquesModule } from './statistiques/statistiques.module';
import { SupportModule } from './support/support.module';
import { TrajetsModule } from './trajets/trajets.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    ReferentielModule,
    TrajetsModule,
    DemandesModule,
    MessagerieModule,
    NotationModule,
    StatistiquesModule,
    SupportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
