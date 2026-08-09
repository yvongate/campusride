import { Module } from '@nestjs/common';
import { NotationController } from './notation.controller';
import { NotationService } from './notation.service';

@Module({
  controllers: [NotationController],
  providers: [NotationService],
})
export class NotationModule {}
