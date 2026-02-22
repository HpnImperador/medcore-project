import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaUsersRepository } from '../infra/repositories/prisma-users.repository';
import { RolesGuard } from '../common/guards/roles.guard';
import { REPOSITORY_TOKENS } from '../domain/repositories/repository-tokens';

@Module({
  controllers: [UsersController],
  providers: [
    PrismaService,
    UsersService,
    RolesGuard,
    {
      provide: REPOSITORY_TOKENS.USERS,
      useClass: PrismaUsersRepository,
    },
  ],
})
export class UsersModule {}
