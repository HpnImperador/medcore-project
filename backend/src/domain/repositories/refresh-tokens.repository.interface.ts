export interface RefreshTokenEntity {
  id: string;
  user_id: string;
  organization_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  revoked_at: Date | null;
  last_used_at: Date | null;
  replaced_by_token_id: string | null;
}

export interface CreateRefreshTokenInput {
  user_id: string;
  organization_id: string;
  token_hash: string;
  expires_at: Date;
}

export interface IRefreshTokensRepository {
  create(input: CreateRefreshTokenInput): Promise<RefreshTokenEntity>;
  findActiveByHash(tokenHash: string): Promise<RefreshTokenEntity | null>;
  listActiveByUserInOrganization(
    userId: string,
    organizationId: string,
  ): Promise<RefreshTokenEntity[]>;
  revokeManyByIds(tokenIds: string[]): Promise<void>;
  revokeById(tokenId: string, replacedByTokenId?: string): Promise<void>;
  touchUsage(tokenId: string): Promise<void>;
  revokeByHash(tokenHash: string): Promise<void>;
  revokeAllByUserInOrganization(
    userId: string,
    organizationId: string,
  ): Promise<void>;
  purgeExpiredAndRevoked(): Promise<number>;
}
