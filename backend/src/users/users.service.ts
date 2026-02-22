import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.interface';
import { normalizeRole } from '../domain/repositories/users.repository.interface';
import type { IUserRepository } from '../domain/repositories/users.repository.interface';
import { REPOSITORY_TOKENS } from '../domain/repositories/repository-tokens';

@Injectable()
export class UsersService {
  constructor(
    @Inject(REPOSITORY_TOKENS.USERS)
    private readonly usersRepository: IUserRepository,
  ) {}

  async me(currentUser: AuthenticatedUser) {
    const profile = await this.usersRepository.findProfileByIdAndOrganization(
      currentUser.userId,
      currentUser.organizationId,
    );

    if (!profile) {
      throw new NotFoundException(
        'Usuário autenticado não encontrado no tenant.',
      );
    }

    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: normalizeRole(profile.role),
      organization_id: profile.organization_id,
      created_at: profile.created_at,
      branch_ids: currentUser.branchIds,
    };
  }
}
