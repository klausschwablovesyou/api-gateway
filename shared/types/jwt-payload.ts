import { UserRole } from './user-role.ts';

export type JwtPayload = {
  userId: string;
  userRole: UserRole;
  email: string;
  iat: number;
  exp: number;
};
