import { Module } from '@nestjs/common';
import {
  NotationController,
  NotationsGlobalController,
  UserAvisController,
} from './notation.controller';
import { NotationService } from './notation.service';

@Module({
  controllers: [NotationController, NotationsGlobalController, UserAvisController],
  providers: [NotationService],
})
export class NotationModule {}
