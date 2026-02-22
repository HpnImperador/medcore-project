import { Role } from './role.enum';

export interface AuthenticatedUser {
  userId: string;
  organizationId: string;
  branchIds: string[];
  role?: Role;
  email?: string;
}
