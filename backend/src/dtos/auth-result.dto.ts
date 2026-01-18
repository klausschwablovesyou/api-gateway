import { User } from '@shared/models/user.model.ts';

export type AuthResult = {
  token: string;
  user: User;
};