import { ConfigService } from '@nestjs/config';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { LoginDto } from './dto/login.dto';
import { normalizeRole } from '../domain/repositories/users.repository.interface';
import type { IUserRepository } from '../domain/repositories/users.repository.interface';
import { REPOSITORY_TOKENS } from '../domain/repositories/repository-tokens';
import type { IRefreshTokensRepository } from '../domain/repositories/refresh-tokens.repository.interface';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.interface';
import { LoginAttemptService } from './login-attempt.service';

interface RefreshTokenPayload {
  sub: string;
  organization_id: string;
  type: 'refresh';
  jti: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(REPOSITORY_TOKENS.USERS)
    private readonly userRepository: IUserRepository,
    @Inject(REPOSITORY_TOKENS.REFRESH_TOKENS)
    private readonly refreshTokensRepository: IRefreshTokensRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly loginAttemptService: LoginAttemptService,
  ) {}

  async login(dto: LoginDto, clientIp: string) {
    const loginKey = this.loginAttemptService.buildKey(dto.email, clientIp);
    const lockStatus = this.loginAttemptService.checkLock(loginKey);
    if (lockStatus.locked) {
      throw new HttpException(
        `Muitas tentativas de login inválidas. Tente novamente em ${lockStatus.retry_after_seconds}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.refreshTokensRepository.purgeExpiredAndRevoked();
    const user = await this.userRepository.findByEmail(dto.email);

    if (!user || !user.organization_id) {
      this.loginAttemptService.registerFailure(loginKey);
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const isValidPassword = await this.validatePassword(
      dto.password,
      user.password_hash,
    );
    if (!isValidPassword) {
      this.loginAttemptService.registerFailure(loginKey);
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    this.loginAttemptService.clear(loginKey);

    const role = normalizeRole(user.role);
    const branchIds = user.user_branches.map((entry) => entry.branch_id);

    const accessToken = await this.createAccessToken({
      userId: user.id,
      email: user.email,
      role,
      organizationId: user.organization_id,
      branchIds,
    });

    const { token: refreshToken } = await this.issueRefreshToken({
      userId: user.id,
      organizationId: user.organization_id,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        organization_id: user.organization_id,
        branch_ids: branchIds,
      },
    };
  }

  async refresh(dto: RefreshTokenDto) {
    await this.refreshTokensRepository.purgeExpiredAndRevoked();
    const payload = await this.verifyRefreshToken(dto.refresh_token);
    const tokenHash = this.hashToken(dto.refresh_token);

    const storedToken =
      await this.refreshTokensRepository.findActiveByHash(tokenHash);
    if (!storedToken) {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    const user = await this.userRepository.findProfileByIdAndOrganization(
      payload.sub,
      payload.organization_id,
    );
    if (!user || !user.organization_id) {
      throw new UnauthorizedException('Usuário inválido para refresh token.');
    }

    const authUser = await this.userRepository.findByEmail(user.email);
    if (!authUser || !authUser.organization_id) {
      throw new UnauthorizedException('Usuário inválido para refresh token.');
    }

    const role = normalizeRole(authUser.role);
    const branchIds = authUser.user_branches.map((entry) => entry.branch_id);

    const issued = await this.issueRefreshToken({
      userId: authUser.id,
      organizationId: authUser.organization_id,
    });
    await this.refreshTokensRepository.revokeById(storedToken.id, issued.id);

    const accessToken = await this.createAccessToken({
      userId: authUser.id,
      email: authUser.email,
      role,
      organizationId: authUser.organization_id,
      branchIds,
    });

    return {
      access_token: accessToken,
      refresh_token: issued.token,
      token_type: 'Bearer',
    };
  }

  async logout(dto: LogoutDto) {
    await this.refreshTokensRepository.purgeExpiredAndRevoked();
    const tokenHash = this.hashToken(dto.refresh_token);
    await this.refreshTokensRepository.revokeByHash(tokenHash);
    return { success: true };
  }

  async logoutAll(currentUser: AuthenticatedUser) {
    await this.refreshTokensRepository.purgeExpiredAndRevoked();
    await this.refreshTokensRepository.revokeAllByUserInOrganization(
      currentUser.userId,
      currentUser.organizationId,
    );

    return { success: true };
  }

  private async validatePassword(
    plainPassword: string,
    passwordHash: string,
  ): Promise<boolean> {
    // Hardening: aceitamos apenas hash bcrypt em produção.
    const isBcryptHash =
      passwordHash.startsWith('$2a$') ||
      passwordHash.startsWith('$2b$') ||
      passwordHash.startsWith('$2y$');

    if (!isBcryptHash) {
      return false;
    }

    return compare(plainPassword, passwordHash);
  }

  private async createAccessToken(params: {
    userId: string;
    email: string;
    role: string;
    organizationId: string;
    branchIds: string[];
  }): Promise<string> {
    const expiresIn = Math.floor(
      this.parseDurationToMs(
        this.configService.get<string>('JWT_EXPIRES_IN') ?? '12h',
      ) / 1000,
    );

    return this.jwtService.signAsync(
      {
        sub: params.userId,
        email: params.email,
        role: params.role,
        organization_id: params.organizationId,
        branch_ids: params.branchIds,
      },
      {
        secret:
          this.configService.get<string>('JWT_SECRET') ?? 'medcore-dev-secret',
        expiresIn,
      },
    );
  }

  private async issueRefreshToken(params: {
    userId: string;
    organizationId: string;
  }): Promise<{ token: string; id: string }> {
    const refreshJti = randomUUID();
    const refreshDuration =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const expiresIn = Math.floor(
      this.parseDurationToMs(refreshDuration) / 1000,
    );
    const expiresAt = new Date(
      Date.now() + this.parseDurationToMs(refreshDuration),
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: params.userId,
        organization_id: params.organizationId,
        type: 'refresh',
        jti: refreshJti,
      },
      {
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ??
          this.configService.get<string>('JWT_SECRET') ??
          'medcore-dev-refresh-secret',
        expiresIn,
      },
    );

    const created = await this.refreshTokensRepository.create({
      user_id: params.userId,
      organization_id: params.organizationId,
      token_hash: this.hashToken(refreshToken),
      expires_at: expiresAt,
    });

    await this.enforceMaxActiveSessions(
      params.userId,
      params.organizationId,
      created.id,
    );

    return {
      token: refreshToken,
      id: created.id,
    };
  }

  private async verifyRefreshToken(
    token: string,
  ): Promise<RefreshTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ??
          this.configService.get<string>('JWT_SECRET') ??
          'medcore-dev-refresh-secret',
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }
  }

  private hashToken(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private async enforceMaxActiveSessions(
    userId: string,
    organizationId: string,
    newestTokenId: string,
  ): Promise<void> {
    const maxActiveSessions = this.getMaxActiveSessions();
    if (maxActiveSessions < 1) {
      return;
    }

    const activeTokens =
      await this.refreshTokensRepository.listActiveByUserInOrganization(
        userId,
        organizationId,
      );

    if (activeTokens.length <= maxActiveSessions) {
      return;
    }

    // Mantém o token recém emitido e revoga os mais antigos acima do limite.
    const revocableTokens = activeTokens
      .filter((token) => token.id !== newestTokenId)
      .slice(0, Math.max(0, activeTokens.length - maxActiveSessions));

    if (revocableTokens.length === 0) {
      return;
    }

    await this.refreshTokensRepository.revokeManyByIds(
      revocableTokens.map((token) => token.id),
    );
  }

  private getMaxActiveSessions(): number {
    const configuredValue = this.configService.get<string>(
      'JWT_MAX_ACTIVE_SESSIONS',
    );
    const parsedValue = Number.parseInt(configuredValue ?? '', 10);

    if (Number.isNaN(parsedValue) || parsedValue <= 0) {
      return 5;
    }

    return parsedValue;
  }

  private parseDurationToMs(duration: string): number {
    const normalized = duration.trim().toLowerCase();
    const numericValue = Number.parseInt(normalized, 10);

    if (Number.isNaN(numericValue)) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    if (normalized.endsWith('h')) {
      return numericValue * 60 * 60 * 1000;
    }

    if (normalized.endsWith('d')) {
      return numericValue * 24 * 60 * 60 * 1000;
    }

    if (normalized.endsWith('m')) {
      return numericValue * 60 * 1000;
    }

    return numericValue * 1000;
  }
}
