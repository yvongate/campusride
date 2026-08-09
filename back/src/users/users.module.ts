import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ComptesController } from './comptes.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule],
  controllers: [UsersController, ComptesController],
  providers: [UsersService],
})
export class UsersModule {}
