import { User } from '@shared/models/user.model';

export type AuthResponseDto = {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
};