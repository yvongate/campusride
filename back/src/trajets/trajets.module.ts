import { Module } from '@nestjs/common';
import { MessagerieModule } from '../messagerie/messagerie.module';
import { SignalementsController } from './signalements.controller';
import { TrajetsController } from './trajets.controller';
import { TrajetsService } from './trajets.service';

@Module({
  imports: [MessagerieModule],
  controllers: [TrajetsController, SignalementsController],
  providers: [TrajetsService],
  exports: [TrajetsService],
})
export class TrajetsModule {}
