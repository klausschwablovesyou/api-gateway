import { beforeEach, describe, it } from '@std/testing/bdd';
import { assertEquals, assertRejects } from '@std/assert';
import { AuthService } from './auth.service.ts';
import { UserRepository } from '../../shared/repositories/user.repository.ts';
import { JwtService } from '../../shared/services/jwt.service.ts';
import { PasswordService } from '../../shared/services/password.service.ts';
import { UserRole } from '@shared/types/user-role.ts';

const VALID_PASSWORD = 'Str0ng!pass';

interface HttpLikeError extends Error {
  status: number;
}

describe('AuthService', () => {
  let usersByUsername: Map<string, Record<string, unknown>>;
  let usersByEmail: Map<string, Record<string, unknown>>;
  let createdUsers: Array<Record<string, unknown>>;
  let tokenRequests: unknown[][];
  let hashed: string[];
  let passwordMatches: boolean;
  let strengthErrors: string[];
  let service: AuthService;

  const storedUser = () => ({
    id: 'user-1',
    username: 'anna',
    email: 'a@example.com',
    password: 'stored-hash',
    userRole: UserRole.Admin,
  });

  async function assertHttpError(call: () => Promise<unknown>, status: number, message: string): Promise<void> {
    const error = await assertRejects(call) as HttpLikeError;
    assertEquals(error.status, status);
    assertEquals(error.message, message);
  }

  beforeEach(() => {
    usersByUsername = new Map();
    usersByEmail = new Map();
    createdUsers = [];
    tokenRequests = [];
    hashed = [];
    passwordMatches = true;
    strengthErrors = [];

    service = new AuthService(
      {
        findByUsername: (username: string) => Promise.resolve(usersByUsername.get(username) ?? null),
        findByEmail: (email: string) => Promise.resolve(usersByEmail.get(email) ?? null),
        create: (user: Record<string, unknown>) => {
          createdUsers.push(user);
          return Promise.resolve({ id: 'new-user', userRole: UserRole.User, ...user });
        },
      } as unknown as UserRepository,
      {
        generateToken: (...args: unknown[]) => {
          tokenRequests.push(args);
          return Promise.resolve('signed-token');
        },
      } as unknown as JwtService,
      {
        verifyPassword: () => Promise.resolve(passwordMatches),
        validatePasswordStrength: () => ({ isValid: strengthErrors.length === 0, errors: strengthErrors }),
        hashPassword: (plain: string) => {
          hashed.push(plain);
          return Promise.resolve('new-hash');
        },
      } as unknown as PasswordService,
    );
  });

  describe('login', () => {
    it('rejects an unknown user with 401', async () => {
      await assertHttpError(() => service.login('nobody', VALID_PASSWORD), 401, 'Auth.Error.InvalidCredentials');
      assertEquals(tokenRequests.length, 0);
    });

    it('rejects a wrong password with the same 401, so usernames cannot be enumerated', async () => {
      usersByUsername.set('anna', storedUser());
      passwordMatches = false;

      await assertHttpError(() => service.login('anna', 'wrong'), 401, 'Auth.Error.InvalidCredentials');
      assertEquals(tokenRequests.length, 0);
    });

    it('issues a token with the real email and role', async () => {
      usersByUsername.set('anna', storedUser());

      const result = await service.login('anna', VALID_PASSWORD);

      assertEquals(result.token, 'signed-token');
      assertEquals(tokenRequests, [['user-1', UserRole.Admin, 'a@example.com']]);
    });

    it('does not return the password or email to the client', async () => {
      usersByUsername.set('anna', storedUser());

      const result = await service.login('anna', VALID_PASSWORD);

      assertEquals(result.user.id, 'user-1');
      assertEquals(result.user.username, 'anna');
      assertEquals(result.user.password, '');
      assertEquals(result.user.email, '');
    });
  });

  describe('register', () => {
    it('rejects a weak password with 400 and every validation error, before touching the database', async () => {
      strengthErrors = ['Auth.Validation.PasswordTooShort', 'Auth.Validation.PasswordNeedsNumber'];

      await assertHttpError(
        () => service.register('anna', 'a@example.com', 'weak'),
        400,
        'Auth.Validation.PasswordTooShort, Auth.Validation.PasswordNeedsNumber',
      );
      assertEquals(createdUsers.length, 0);
    });

    it('rejects a taken username with 409', async () => {
      usersByUsername.set('anna', storedUser());

      await assertHttpError(
        () => service.register('anna', 'new@example.com', VALID_PASSWORD),
        409,
        'Auth.Error.UsernameExists',
      );
      assertEquals(createdUsers.length, 0);
    });

    it('rejects a taken email with 409', async () => {
      usersByEmail.set('a@example.com', storedUser());

      await assertHttpError(
        () => service.register('new', 'a@example.com', VALID_PASSWORD),
        409,
        'Auth.Error.EmailExists',
      );
      assertEquals(createdUsers.length, 0);
    });

    it('stores only the hash of the password, never with a caller-supplied role', async () => {
      await service.register('new', 'new@example.com', VALID_PASSWORD);

      assertEquals(hashed, [VALID_PASSWORD]);
      assertEquals(createdUsers, [{ username: 'new', email: 'new@example.com', password: 'new-hash' }]);
    });

    it('returns a token for the created user', async () => {
      const result = await service.register('new', 'new@example.com', VALID_PASSWORD);

      assertEquals(result.token, 'signed-token');
      assertEquals(result.user.id, 'new-user');
      assertEquals(tokenRequests, [['new-user', UserRole.User, 'new@example.com']]);
    });

    it('does not return the password hash to the client', async () => {
      const result = await service.register('new', 'new@example.com', VALID_PASSWORD);

      assertEquals(JSON.stringify(result.user).includes('new-hash'), false);
    });
  });
});
