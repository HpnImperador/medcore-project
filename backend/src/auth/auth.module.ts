import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaUsersRepository } from '../infra/repositories/prisma-users.repository';
import { PrismaRefreshTokensRepository } from '../infra/repositories/prisma-refresh-tokens.repository';
import { REPOSITORY_TOKENS } from '../domain/repositories/repository-tokens';
import { LoginAttemptService } from './login-attempt.service';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') ?? 'medcore-dev-secret',
        signOptions: { expiresIn: '12h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    PrismaService,
    AuthService,
    LoginAttemptService,
    RolesGuard,
    {
      provide: REPOSITORY_TOKENS.USERS,
      useClass: PrismaUsersRepository,
    },
    {
      provide: REPOSITORY_TOKENS.REFRESH_TOKENS,
      useClass: PrismaRefreshTokensRepository,
    },
  ],
  exports: [JwtModule],
})
export class AuthModule {}
