import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

// Global : presque tous les modules metier notifient (demandes, trajets,
// messagerie, users...). Les faire tous importer NotificationsModule
// n'apporterait rien et multiplierait les risques de dependance circulaire.
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
