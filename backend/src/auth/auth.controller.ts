import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.interface';

interface RequestWithIp {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
}
