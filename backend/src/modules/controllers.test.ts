import { beforeEach, describe, it } from '@std/testing/bdd';
import { assertEquals, assertRejects } from '@std/assert';
import { ApiManagerController } from './api-manager/api-manager.controller.ts';
import { ApiManagerService } from './api-manager/api-manager.service.ts';
import { AuthService } from './auth/auth.service.ts';
import { LoginController } from './auth/login.controller.ts';
import { ConfigManagerController } from './config-manager/config-manager.controller.ts';
import { ConfigManagerService } from './config-manager/config-manager.service.ts';
import { GatewayController } from './gateway/gateway.controller.ts';
import { IpManagerController } from './ip-manager/ip-manager.controller.ts';
import { IpManagerService } from './ip-manager/ip-manager.service.ts';
import { RealtimeController } from './realtime/realtime.controller.ts';
import { RealtimeService } from './realtime/realtime.service.ts';
import { RequestLogController } from './request-log/request-log.controller.ts';
import { ROLES_KEY } from '../shared/decorators/roles.decorator.ts';
import { RequestLogRepository } from '../shared/repositories/request-log.repository.ts';
import { JwtService } from '../shared/services/jwt.service.ts';
import { UserRole } from '@shared/types/user-role.ts';
import { assertRejectsHttp, FakeSocket, useSilentConsole } from '../testing/test-helpers.ts';

/** Same lookup as RolesGuard: method-level roles win, then class-level roles, otherwise the route is public. */
function requiredRoles(controller: new (...args: never[]) => unknown, method: string): string[] {
  const handler = (controller.prototype as Record<string, unknown>)[method] as object;
  const handlerRoles = Reflect.getMetadata(ROLES_KEY, handler) as string[] | undefined;
  if (handlerRoles?.length) {
    return handlerRoles;
  }
  return (Reflect.getMetadata(ROLES_KEY, controller) as string[] | undefined) ?? [];
}

describe('route access rules', () => {
  const everyRole = [...Object.values(UserRole)].sort();
  const superAdminOnly = [UserRole.SuperAdmin];

  const publicRoutes: Array<[new (...args: never[]) => unknown, string]> = [
    [LoginController, 'login'],
    [LoginController, 'register'],
    [ConfigManagerController, 'getPublicConfig'],
    [GatewayController, 'get'],
  ];

  for (const [controller, method] of publicRoutes) {
    it(`${controller.name}.${method} is public`, () => {
      assertEquals(requiredRoles(controller, method), []);
    });
  }

  for (const method of ['create', 'findAll', 'findById', 'update', 'delete', 'regenerateKeys']) {
    it(`ApiManagerController.${method} requires a logged-in user`, () => {
      assertEquals([...requiredRoles(ApiManagerController, method)].sort(), everyRole);
    });
  }

  for (const method of ['create', 'sync', 'findAll', 'findById', 'update', 'delete']) {
    it(`IpManagerController.${method} is SuperAdmin only`, () => {
      assertEquals(requiredRoles(IpManagerController, method), superAdminOnly);
    });
  }

  it('ConfigManagerController.updateConfig is SuperAdmin only', () => {
    assertEquals(requiredRoles(ConfigManagerController, 'updateConfig'), superAdminOnly);
  });

  it('RequestLogController.findAll is SuperAdmin only', () => {
    assertEquals(requiredRoles(RequestLogController, 'findAll'), superAdminOnly);
  });
});

describe('ApiManagerController', () => {
  let found: unknown;
  let controller: ApiManagerController;

  beforeEach(() => {
    found = { id: 'api-1' };
    controller = new ApiManagerController({
      create: (dto: unknown) => Promise.resolve({ created: dto }),
      findAll: () => Promise.resolve([{ id: 'api-1' }]),
      findById: () => Promise.resolve(found),
      update: () => Promise.resolve(found),
      delete: () => Promise.resolve(true),
      regenerateKeys: (id: string) => Promise.resolve({ regenerated: id }),
    } as unknown as ApiManagerService);
  });

  it('delegates create, findAll and regenerateKeys', async () => {
    assertEquals(await controller.create({ name: 'a' } as never), { created: { name: 'a' } } as never);
    assertEquals(await controller.findAll(), [{ id: 'api-1' }] as never);
    assertEquals(await controller.regenerateKeys('api-1'), { regenerated: 'api-1' } as never);
  });

  it('findById returns the API, or 404', async () => {
    assertEquals(await controller.findById('api-1'), { id: 'api-1' } as never);

    found = null;
    await assertRejectsHttp(() => controller.findById('missing'), 404, 'API not found');
  });

  it('update returns the API, or 404', async () => {
    assertEquals(await controller.update('api-1', {}), { id: 'api-1' } as never);

    found = null;
    await assertRejectsHttp(() => controller.update('missing', {}), 404, 'API not found');
  });

  it('delete wraps the result', async () => {
    assertEquals(await controller.delete('api-1'), { success: true });
  });
});

describe('IpManagerController', () => {
  let found: unknown;
  let controller: IpManagerController;

  beforeEach(() => {
    found = { id: 'ip-1' };
    controller = new IpManagerController({
      create: (dto: unknown) => Promise.resolve({ created: dto }),
      syncAll: () => Promise.resolve({ total: 1 }),
      findAll: () => Promise.resolve([{ id: 'ip-1' }]),
      findById: () => Promise.resolve(found),
      update: () => Promise.resolve(found),
      delete: () => Promise.resolve(false),
    } as unknown as IpManagerService);
  });

  it('delegates create, sync and findAll', async () => {
    assertEquals(await controller.create({ ip: '1.1.1.1' }), { created: { ip: '1.1.1.1' } } as never);
    assertEquals(await controller.sync(), { total: 1 } as never);
    assertEquals(await controller.findAll(), [{ id: 'ip-1' }] as never);
  });

  it('findById returns the IP, or 404', async () => {
    assertEquals(await controller.findById('ip-1'), { id: 'ip-1' } as never);

    found = null;
    await assertRejectsHttp(() => controller.findById('missing'), 404, 'IP not found');
  });

  it('update returns the IP, or 404', async () => {
    assertEquals(await controller.update('ip-1', {}), { id: 'ip-1' } as never);

    found = null;
    await assertRejectsHttp(() => controller.update('missing', {}), 404, 'IP not found');
  });

  it('delete wraps the result', async () => {
    assertEquals(await controller.delete('ip-1'), { success: false });
  });
});

describe('ConfigManagerController', () => {
  it('delegates reading and updating the config', async () => {
    const controller = new ConfigManagerController({
      getConfig: () => Promise.resolve({ enableRegistration: true }),
      updateConfig: (dto: unknown) => Promise.resolve(dto),
    } as unknown as ConfigManagerService);

    assertEquals(await controller.getPublicConfig(), { enableRegistration: true });
    assertEquals(await controller.updateConfig({ enableRegistration: false }), { enableRegistration: false });
  });
});

describe('LoginController', () => {
  const authResult = { token: 'token', user: { id: 'user-1' } };

  let registrationEnabled: boolean;
  let authCalls: unknown[][];
  let controller: LoginController;

  beforeEach(() => {
    registrationEnabled = true;
    authCalls = [];
    controller = new LoginController(
      {
        login: (...args: unknown[]) => {
          authCalls.push(['login', ...args]);
          return Promise.resolve(authResult);
        },
        register: (...args: unknown[]) => {
          authCalls.push(['register', ...args]);
          return Promise.resolve(authResult);
        },
      } as unknown as AuthService,
      { isRegistrationEnabled: () => Promise.resolve(registrationEnabled) } as unknown as ConfigManagerService,
    );
  });

  it('login returns the token and user', async () => {
    const response = await controller.login({ username: 'anna', password: 'secret' });

    assertEquals(response, { success: true, ...authResult } as never);
    assertEquals(authCalls, [['login', 'anna', 'secret']]);
  });

  it('login passes errors on', async () => {
    const failing = new LoginController(
      { login: () => Promise.reject(new Error('Auth.Error.InvalidCredentials')) } as unknown as AuthService,
      {} as ConfigManagerService,
    );

    await assertRejects(
      () => failing.login({ username: 'anna', password: 'wrong' }),
      Error,
      'Auth.Error.InvalidCredentials',
    );
  });

  it('register is rejected with 403 when registration is disabled', async () => {
    registrationEnabled = false;

    await assertRejectsHttp(
      () => controller.register({ username: 'anna', email: 'a@example.com', password: 'secret' }),
      403,
      'Registration is disabled',
    );
    assertEquals(authCalls.length, 0);
  });

  it('register returns the token and user when enabled', async () => {
    const response = await controller.register({ username: 'anna', email: 'a@example.com', password: 'secret' });

    assertEquals(response, { success: true, ...authResult } as never);
    assertEquals(authCalls, [['register', 'anna', 'a@example.com', 'secret']]);
  });
});

describe('RequestLogController', () => {
  let received: unknown[][];
  let controller: RequestLogController;

  beforeEach(() => {
    received = [];
    controller = new RequestLogController({
      findAll: (...args: unknown[]) => {
        received.push(args);
        return Promise.resolve([{ id: 'log-1' }]);
      },
    } as unknown as RequestLogRepository);
  });

  it('defaults to limit 100 and offset 0', async () => {
    assertEquals(await controller.findAll(), [{ id: 'log-1' }] as never);
    assertEquals(received, [[100, 0]]);
  });

  it('parses limit and offset from the query string', async () => {
    await controller.findAll('25', '50');

    assertEquals(received, [[25, 50]]);
  });
});

describe('RealtimeController', () => {
  useSilentConsole();

  let added: unknown[][];
  let controller: RealtimeController;

  beforeEach(() => {
    added = [];
    controller = new RealtimeController(
      { addClient: (...args: unknown[]) => added.push(args) } as unknown as RealtimeService,
      {
        extractUserFromToken: (token: string) =>
          Promise.resolve(token === 'valid' ? { userId: 'user-1', userRole: UserRole.Admin, email: 'a@example.com' } : null),
      } as unknown as JwtService,
    );
  });

  for (const [description, payload] of [['an empty payload', {}], ['no payload', undefined]] as const) {
    it(`closes the socket with 4001 for ${description}`, async () => {
      const socket = new FakeSocket();

      await controller.subscribe(socket.asWebSocket(), payload as never);

      assertEquals(socket.closed, { code: 4001, reason: 'Token required' });
      assertEquals(added.length, 0);
    });
  }

  it('closes the socket with 4002 for an invalid token', async () => {
    const socket = new FakeSocket();

    await controller.subscribe(socket.asWebSocket(), { token: 'forged' });

    assertEquals(socket.closed, { code: 4002, reason: 'Invalid token' });
    assertEquals(added.length, 0);
  });

  it('registers the client with the identity from the token', async () => {
    const socket = new FakeSocket();

    await controller.subscribe(socket.asWebSocket(), { token: 'valid' });

    assertEquals(socket.closed, null);
    assertEquals(added, [['user-1', UserRole.Admin, socket]]);
  });
});
