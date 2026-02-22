import { Role } from '../../common/auth/role.enum';

export interface UserBranchEntity {
  branch_id: string;
}

export interface UserAuthEntity {
  id: string;
  organization_id: string | null;
  name: string;
  email: string;
  password_hash: string;
  role: string | null;
  user_branches: UserBranchEntity[];
}

export interface UserProfileEntity {
  id: string;
  organization_id: string | null;
  name: string;
  email: string;
  role: string | null;
  created_at: Date | null;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<UserAuthEntity | null>;
  findProfileByIdAndOrganization(
    userId: string,
    organizationId: string,
  ): Promise<UserProfileEntity | null>;
}

export function normalizeRole(value: string | null): Role {
  if (value === Role.ADMIN || value === Role.DOCTOR) {
    return value;
  }

  return Role.USER;
}
