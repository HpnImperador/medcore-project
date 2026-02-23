import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { normalizeRole } from '../domain/repositories/users.repository.interface';
import type { IUserRepository } from '../domain/repositories/users.repository.interface';
import { REPOSITORY_TOKENS } from '../domain/repositories/repository-tokens';

@Injectable()
export class AuthService {
  constructor(
    @Inject(REPOSITORY_TOKENS.USERS)
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userRepository.findByEmail(dto.email);

    if (!user || !user.organization_id) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const isValidPassword = await this.validatePassword(
      dto.password,
      user.password_hash,
    );
    if (!isValidPassword) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const role = normalizeRole(user.role);
    const branchIds = user.user_branches.map((entry) => entry.branch_id);

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role,
      organization_id: user.organization_id,
      branch_ids: branchIds,
    });

    return {
      access_token: accessToken,
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
}
