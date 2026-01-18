import { HonoRequest } from 'jsr:@hono/hono@4.6.3/request';
import { UserRole } from '@shared/types/user-role';

export interface AuthenticatedRequest extends HonoRequest {
  user: {
    id: string;
    userId: string;
    userRole: UserRole;
    email: string;
  };
}
