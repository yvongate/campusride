import { Module } from '@nestjs/common';
import { TrajetsModule } from '../trajets/trajets.module';
import { DemandesController } from './demandes.controller';
import { DemandesService } from './demandes.service';

@Module({
  imports: [TrajetsModule],
  controllers: [DemandesController],
  providers: [DemandesService],
})
export class DemandesModule {}
