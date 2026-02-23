import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateRefreshTokenInput,
  IRefreshTokensRepository,
  RefreshTokenEntity,
} from '../../domain/repositories/refresh-tokens.repository.interface';

interface RefreshTokensDelegate {
  create(args: {
    data: {
      user_id: string;
      organization_id: string;
      token_hash: string;
      expires_at: Date;
    };
  }): Promise<RefreshTokenEntity>;
  findFirst(args: {
    where: {
      token_hash: string;
      revoked_at: null;
      expires_at: { gt: Date };
    };
  }): Promise<RefreshTokenEntity | null>;
  update(args: {
    where: { id: string };
    data: {
      revoked_at?: Date;
      last_used_at?: Date;
      replaced_by_token_id?: string;
    };
  }): Promise<RefreshTokenEntity>;
  updateMany(args: {
    where: {
      token_hash?: string;
      user_id?: string;
      organization_id?: string;
      revoked_at?: null;
      expires_at?: { lte: Date };
    };
    data: {
      revoked_at?: Date;
      last_used_at?: Date;
    };
  }): Promise<{ count: number }>;
  deleteMany(args: {
    where: {
      OR: Array<{ expires_at: { lte: Date } } | { revoked_at: { lte: Date } }>;
    };
  }): Promise<{ count: number }>;
}

interface PrismaWithRefreshTokens {
  refresh_tokens: RefreshTokensDelegate;
}

@Injectable()
export class PrismaRefreshTokensRepository implements IRefreshTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateRefreshTokenInput): Promise<RefreshTokenEntity> {
    return this.refreshTokensDelegate.create({
      data: {
        user_id: input.user_id,
        organization_id: input.organization_id,
        token_hash: input.token_hash,
        expires_at: input.expires_at,
      },
    });
  }

  findActiveByHash(tokenHash: string): Promise<RefreshTokenEntity | null> {
    return this.refreshTokensDelegate.findFirst({
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
    await this.refreshTokensDelegate.update({
      where: { id: tokenId },
      data: {
        revoked_at: new Date(),
        last_used_at: new Date(),
        replaced_by_token_id: replacedByTokenId,
      },
    });
  }

  async touchUsage(tokenId: string): Promise<void> {
    await this.refreshTokensDelegate.update({
      where: { id: tokenId },
      data: {
        last_used_at: new Date(),
      },
    });
  }

  async revokeByHash(tokenHash: string): Promise<void> {
    await this.refreshTokensDelegate.updateMany({
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

  async revokeAllByUserInOrganization(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    await this.refreshTokensDelegate.updateMany({
      where: {
        user_id: userId,
        organization_id: organizationId,
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(),
        last_used_at: new Date(),
      },
    });
  }

  async purgeExpiredAndRevoked(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.refreshTokensDelegate.deleteMany({
      where: {
        OR: [
          { expires_at: { lte: new Date() } },
          { revoked_at: { lte: thirtyDaysAgo } },
        ],
      },
    });

    return result.count;
  }

  private get refreshTokensDelegate(): RefreshTokensDelegate {
    return (this.prisma as unknown as PrismaWithRefreshTokens).refresh_tokens;
  }
}
