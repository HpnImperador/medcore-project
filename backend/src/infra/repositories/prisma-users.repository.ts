import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IUserRepository,
  UserAuthEntity,
  UserProfileEntity,
} from '../../domain/repositories/users.repository.interface';

@Injectable()
export class PrismaUsersRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserAuthEntity | null> {
    return this.prisma.users.findFirst({
      where: { email },
      select: {
        id: true,
        organization_id: true,
        name: true,
        email: true,
        password_hash: true,
        role: true,
        user_branches: {
          select: {
            branch_id: true,
          },
        },
      },
    });
  }

  async findProfileByIdAndOrganization(
    userId: string,
    organizationId: string,
  ): Promise<UserProfileEntity | null> {
    return this.prisma.users.findFirst({
      where: {
        id: userId,
        organization_id: organizationId,
      },
      select: {
        id: true,
        organization_id: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
      },
    });
  }
}
