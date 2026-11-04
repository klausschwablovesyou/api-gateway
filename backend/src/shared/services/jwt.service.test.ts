import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import { assertEquals, assertExists, assertRejects } from '@std/assert';
import { signJWT } from '@cross/jwt';
import { JwtService } from './jwt.service.ts';
import { UserRole } from '@shared/types/user-role.ts';
import { useSilentConsole, withEnv } from '../../testing/test-helpers.ts';

const SECRET = 'unit-test-secret-that-is-at-least-32-bytes';

describe('JwtService', () => {
  useSilentConsole();

  let service: JwtService;
  let restoreEnv: () => void;

  beforeEach(() => {
    restoreEnv = withEnv({ JWT_SECRET: SECRET });
    service = new JwtService();
  });

  afterEach(() => restoreEnv());

  describe('generateToken / verifyToken', () => {
    it('round-trips the user claims', async () => {
      const token = await service.generateToken('user-1', UserRole.Admin, 'a@example.com');
      const payload = await service.verifyToken(token);

      assertExists(payload);
      assertEquals(payload.userId, 'user-1');
      assertEquals(payload.userRole, UserRole.Admin);
      assertEquals(payload.email, 'a@example.com');
    });

    it('issues tokens that expire after 24 hours', async () => {
      const before = Math.floor(Date.now() / 1000);
      const payload = await service.verifyToken(await service.generateToken('user-1', UserRole.User, 'a@example.com'));
      const after = Math.floor(Date.now() / 1000);

      assertExists(payload);
      assertEquals(payload.exp >= before + 86400 && payload.exp <= after + 86400, true);
    });

    it('returns null for a malformed token', async () => {
      assertEquals(await service.verifyToken('not-a-jwt'), null);
    });

    it('returns null for a token with a tampered payload', async () => {
      const [header, , signature] = (await service.generateToken('user-1', UserRole.User, 'a@example.com')).split('.');
      const forged = btoa(JSON.stringify({ userId: 'user-1', userRole: UserRole.SuperAdmin }))
        .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

      assertEquals(await service.verifyToken(`${header}.${forged}.${signature}`), null);
    });

    it('returns null for a token signed with another secret', async () => {
      const token = await signJWT({ userId: 'user-1' }, 'another-secret-that-is-at-least-32-bytes-long');

      assertEquals(await service.verifyToken(token), null);
    });

    it('returns null for an expired token', async () => {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const token = await signJWT({ userId: 'user-1', iat: nowInSeconds - 7200, exp: nowInSeconds - 3600 }, SECRET);

      assertEquals(await service.verifyToken(token), null);
    });

    it('returns null for a token without an expiry', async () => {
      const token = await signJWT({ userId: 'user-1' }, SECRET);

      assertEquals(await service.verifyToken(token), null);
    });

    it('returns null for an unsigned (alg: none) token', async () => {
      const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, '');
      const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ userId: 'x', userRole: UserRole.SuperAdmin })}.`;

      assertEquals(await service.verifyToken(token), null);
    });

    it('refuses to sign when JWT_SECRET is not configured', async () => {
      const restore = withEnv({ JWT_SECRET: undefined });

      try {
        const unconfigured = new JwtService();
        await assertRejects(() => unconfigured.generateToken('user-1', UserRole.User, 'a@example.com'));
      } finally {
        restore();
      }
    });
  });

  describe('extractUserFromToken', () => {
    it('returns only the user fields of a valid token', async () => {
      const token = await service.generateToken('user-1', UserRole.SuperAdmin, 'a@example.com');

      assertEquals(await service.extractUserFromToken(token), {
        userId: 'user-1',
        userRole: UserRole.SuperAdmin,
        email: 'a@example.com',
      });
    });

    it('returns null for an invalid token', async () => {
      assertEquals(await service.extractUserFromToken('not-a-jwt'), null);
    });
  });
});
