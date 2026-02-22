import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../auth/authenticated-user.interface';

interface JwtPayload {
  sub?: string;
  user_id?: string;
  id?: string;
  organization_id?: string;
  organizationId?: string;
  branch_ids?: string[];
  branchIds?: string[];
  role?: string;
  email?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ?? 'medcore-dev-secret',
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    const userId = payload.sub ?? payload.user_id ?? payload.id;
    const organizationId = payload.organization_id ?? payload.organizationId;

    if (!userId || !organizationId) {
      throw new UnauthorizedException(
        'Token JWT sem contexto mínimo de usuário/organização.',
      );
    }

    return {
      userId,
      organizationId,
      branchIds: payload.branch_ids ?? payload.branchIds ?? [],
      role: payload.role,
      email: payload.email,
    };
  }
}
