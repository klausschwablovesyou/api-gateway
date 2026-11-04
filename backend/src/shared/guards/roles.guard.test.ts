import { beforeEach, describe, it } from '@std/testing/bdd';
import { assertEquals, assertRejects } from '@std/assert';
import { spy } from '@std/testing/mock';
import { ExecutionContext, UnauthorizedException } from '@danet/core';
import { RolesGuard } from './roles.guard.ts';
import { Roles } from '../decorators/roles.decorator.ts';
import { JwtService } from '../services/jwt.service.ts';
import { UserRole } from '@shared/types/user-role.ts';

class PublicController {
  public open(): void {}
}

@Roles(UserRole.Admin)
class AdminController {
  public inherited(): void {}

  @Roles(UserRole.SuperAdmin)
  public superOnly(): void {}
}

class MixedController {
  @Roles(UserRole.SuperAdmin, UserRole.Admin)
  public twoRoles(): void {}

  @Roles()
  public emptyRoles(): void {}
}

interface FakeRequest {
  header: (name: string) => string | undefined;
  user?: unknown;
}

function createContext(
  controller: unknown,
  handler: unknown,
  authorization?: string,
): { context: ExecutionContext; request: FakeRequest } {
  const request: FakeRequest = {
    header: (name) => (name === 'authorization' ? authorization : undefined),
  };
  const context = {
    req: request,
    getHandler: () => handler,
    getClass: () => controller,
  } as unknown as ExecutionContext;

  return { context, request };
}

describe('RolesGuard', () => {
  const claims = { userId: 'user-1', userRole: UserRole.Admin, email: 'a@example.com' };

  let extractUser: (token: string) => Promise<typeof claims | null>;
  let guard: RolesGuard;

  beforeEach(() => {
    extractUser = spy((token: string) => Promise.resolve(token === 'valid' ? claims : null));
    guard = new RolesGuard({ extractUserFromToken: extractUser } as unknown as JwtService);
  });

  describe('public routes', () => {
    it('allows a route without @Roles and does not look at the token', async () => {
      const { context } = createContext(PublicController, PublicController.prototype.open);

      assertEquals(await guard.canActivate(context), true);
      assertEquals((extractUser as unknown as { calls: unknown[] }).calls.length, 0);
    });

    it('treats an empty @Roles() as public', async () => {
      const { context } = createContext(MixedController, MixedController.prototype.emptyRoles);

      assertEquals(await guard.canActivate(context), true);
    });

    it('allows a WebSocket connection, whose context has no handler or class accessors', async () => {
      const context = { req: { header: () => undefined } } as unknown as ExecutionContext;

      assertEquals(await guard.canActivate(context), true);
    });
  });

  describe('authentication', () => {
    const handler = AdminController.prototype.inherited;

    it('rejects a missing authorization header', async () => {
      const { context } = createContext(AdminController, handler);

      await assertRejects(() => guard.canActivate(context), UnauthorizedException);
    });

    it('rejects a non-Bearer scheme', async () => {
      const { context } = createContext(AdminController, handler, 'Basic valid');

      await assertRejects(() => guard.canActivate(context), UnauthorizedException);
    });

    it('rejects a Bearer header without a token', async () => {
      const { context } = createContext(AdminController, handler, 'Bearer');

      await assertRejects(() => guard.canActivate(context), UnauthorizedException);
    });

    it('rejects an invalid token', async () => {
      const { context } = createContext(AdminController, handler, 'Bearer forged');

      await assertRejects(() => guard.canActivate(context), UnauthorizedException);
    });
  });

  describe('authorization', () => {
    it('allows a role from the class-level @Roles', async () => {
      const { context } = createContext(AdminController, AdminController.prototype.inherited, 'Bearer valid');

      assertEquals(await guard.canActivate(context), true);
    });

    it('allows a role when several roles are accepted', async () => {
      const { context } = createContext(MixedController, MixedController.prototype.twoRoles, 'Bearer valid');

      assertEquals(await guard.canActivate(context), true);
    });

    it('lets a method-level @Roles override the class-level one', async () => {
      const { context } = createContext(AdminController, AdminController.prototype.superOnly, 'Bearer valid');

      assertEquals(await guard.canActivate(context), false);
    });

    it('attaches the user to the request', async () => {
      const { context, request } = createContext(AdminController, AdminController.prototype.inherited, 'Bearer valid');

      await guard.canActivate(context);

      assertEquals(request.user, {
        id: 'user-1',
        userId: 'user-1',
        userRole: UserRole.Admin,
        email: 'a@example.com',
      });
    });
  });
});
