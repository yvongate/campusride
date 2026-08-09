import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UsersService } from './users.service';

@ApiTags('Comptes')
@ApiBearerAuth('access-token')
@Controller('admin/utilisateurs')
export class ComptesController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async listerComptes() {
    return this.usersService.listerComptes();
  }

  @Patch(':id/desactiver')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async desactiverCompte(@Param('id') id: string) {
    return this.usersService.desactiverCompte(id);
  }

  @Patch(':id/reactiver')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async reactiverCompte(@Param('id') id: string) {
    return this.usersService.reactiverCompte(id);
  }
}
