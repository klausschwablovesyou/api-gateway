import { UserRole } from '@shared/types/user-role';

export type ClientInfo = {
  socket: WebSocket;
  userRole: UserRole;
}
