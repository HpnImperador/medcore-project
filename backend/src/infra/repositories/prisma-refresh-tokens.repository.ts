import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateRefreshTokenInput,
  IRefreshTokensRepository,
  RefreshTokenEntity,
} from '../../domain/repositories/refresh-tokens.repository.interface';

@Injectable()
export class PrismaRefreshTokensRepository implements IRefreshTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateRefreshTokenInput): Promise<RefreshTokenEntity> {
    return this.prisma.refresh_tokens.create({
      data: {
        user_id: input.user_id,
        organization_id: input.organization_id,
        token_hash: input.token_hash,
        expires_at: input.expires_at,
      },
    });
  }

  async findActiveByHash(tokenHash: string): Promise<RefreshTokenEntity | null> {
    return this.prisma.refresh_tokens.findFirst({
      where: {
        token_hash: tokenHash,
        revoked_at: null,
        expires_at: {
          gt: new Date(),
        },
      },
    });
  }

  async revokeById(tokenId: string, replacedByTokenId?: string): Promise<void> {
    await this.prisma.refresh_tokens.update({
      where: { id: tokenId },
      data: {
        revoked_at: new Date(),
        last_used_at: new Date(),
        replaced_by_token_id: replacedByTokenId,
      },
    });
  }

  async touchUsage(tokenId: string): Promise<void> {
    await this.prisma.refresh_tokens.update({
      where: { id: tokenId },
      data: {
        last_used_at: new Date(),
      },
    });
  }

  async revokeByHash(tokenHash: string): Promise<void> {
    await this.prisma.refresh_tokens.updateMany({
      where: {
        token_hash: tokenHash,
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(),
        last_used_at: new Date(),
      },
    });
  }
}
