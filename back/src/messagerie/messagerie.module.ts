import { Module } from '@nestjs/common';
import { MessagerieController } from './messagerie.controller';
import { MessagerieService } from './messagerie.service';

@Module({
  controllers: [MessagerieController],
  providers: [MessagerieService],
  exports: [MessagerieService],
})
export class MessagerieModule {}
