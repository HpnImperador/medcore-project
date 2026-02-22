import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/auth/role.enum';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.interface';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @Roles(Role.USER, Role.ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'Retorna os dados do usuário autenticado' })
  async me(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.usersService.me(currentUser);
  }
}
