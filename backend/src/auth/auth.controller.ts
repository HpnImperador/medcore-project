import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.interface';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/auth/role.enum';
import { LoginLockQueryDto } from './dto/login-lock-query.dto';
import { LoginAttemptService } from './login-attempt.service';
import { ClearLoginLockDto } from './dto/clear-login-lock.dto';

interface RequestWithIp {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginAttemptService: LoginAttemptService,
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'Autentica usuário e retorna token JWT' })
  async login(@Body() loginDto: LoginDto, @Req() request: RequestWithIp) {
    const xForwardedFor = request.headers?.['x-forwarded-for'];
    const forwardedIp = Array.isArray(xForwardedFor)
      ? xForwardedFor[0]
      : xForwardedFor?.split(',')[0]?.trim();
    const clientIp = forwardedIp ?? request.ip ?? 'ip-indisponivel';

    return this.authService.login(loginDto, clientIp);
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Rotaciona refresh token e emite novo par de tokens',
  })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revoga refresh token atual (logout)' })
  async logout(@Body() logoutDto: LogoutDto) {
    return this.authService.logout(logoutDto);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Revoga todas as sessões do usuário autenticado' })
  async logoutAll(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.authService.logoutAll(currentUser);
  }

  @Get('login-lock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Consulta status de bloqueio de login por email+ip (somente ADMIN)',
  })
  loginLockStatus(@Query() query: LoginLockQueryDto) {
    return this.loginAttemptService.getStatusByIdentity(query.email, query.ip);
  }

  @Post('login-lock/clear')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Remove bloqueio/tentativas de login por email+ip para suporte operacional (somente ADMIN)',
  })
  clearLoginLock(@Body() dto: ClearLoginLockDto) {
    this.loginAttemptService.clearByIdentity(dto.email, dto.ip);
    return {
      success: true,
      email: dto.email.trim().toLowerCase(),
      ip: dto.ip.trim().toLowerCase(),
    };
  }
}
