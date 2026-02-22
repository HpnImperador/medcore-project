export interface AuthenticatedUser {
  userId: string;
  organizationId: string;
  branchIds: string[];
  role?: string;
  email?: string;
}
