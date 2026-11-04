import { beforeEach, describe, it } from '@std/testing/bdd';
import { assertEquals, assertRejects, assertStringIncludes } from '@std/assert';
import { ApiRepository } from './api.repository.ts';
import { ConfigRepository } from './config.repository.ts';
import { IpRepository } from './ip.repository.ts';
import { IpUsageRepository } from './ip-usage.repository.ts';
import { RequestLogRepository } from './request-log.repository.ts';
import { UserRepository } from './user.repository.ts';
import { PostgresService } from '../database/postgres.service.ts';
import { HttpMethod } from '@shared/types/http-method.ts';
import { RequestLimitUnit } from '@shared/types/request-limit-unit.ts';
import { UserRole } from '@shared/types/user-role.ts';
import { FakePostgres } from '../../testing/test-helpers.ts';

let db: FakePostgres;
const asService = () => db as unknown as PostgresService;

beforeEach(() => {
  db = new FakePostgres();
});

describe('ApiRepository', () => {
  const api = {
    name: 'weather',
    apiUrl: 'https://example.com',
    method: HttpMethod.GET,
    publicKey: 'pub',
    privateKey: 'priv',
    requestLimit: 10,
    requestLimitUnit: RequestLimitUnit.Minute,
  };
  const stored = { id: 'api-1', ...api };

  it('create inserts every column in order and returns the row', async () => {
    db.results.queryOne = stored;

    assertEquals(await new ApiRepository(asService()).create(api), stored);
    assertEquals(db.lastCall.params, ['weather', 'https://example.com', 'GET', 'pub', 'priv', 10, 'minute']);
  });

  it('create throws when the database returns no row', async () => {
    await assertRejects(() => new ApiRepository(asService()).create(api), Error, 'Failed to create API');
  });

  const lookups: Array<[string, (repo: ApiRepository) => Promise<unknown>, string, string]> = [
    ['findById', (repo) => repo.findById('api-1'), 'WHERE id = $1', 'api-1'],
    ['findByName', (repo) => repo.findByName('weather'), 'WHERE name = $1', 'weather'],
    ['findByPublicKey', (repo) => repo.findByPublicKey('pub'), 'WHERE public_key = $1', 'pub'],
  ];

  for (const [name, call, where, param] of lookups) {
    it(`${name} filters with a bound parameter`, async () => {
      db.results.queryOne = stored;

      assertEquals(await call(new ApiRepository(asService())), stored);
      assertStringIncludes(db.lastCall.sql, where);
      assertEquals(db.lastCall.params, [param]);
    });
  }

  it('findAll orders by name', async () => {
    db.results.query = [stored];

    assertEquals(await new ApiRepository(asService()).findAll(), [stored]);
    assertStringIncludes(db.lastCall.sql, 'ORDER BY name ASC');
  });

  describe('update', () => {
    it('returns null when the API does not exist, without updating', async () => {
      assertEquals(await new ApiRepository(asService()).update('missing', { name: 'x' }), null);
      assertEquals(db.calls.length, 1);
    });

    it('returns the existing API when there is nothing to change', async () => {
      db.results.queryOne = stored;

      assertEquals(await new ApiRepository(asService()).update('api-1', {}), stored);
      assertEquals(db.calls.length, 1);
    });

    it('updates only the provided fields, numbering parameters in order', async () => {
      db.results.queryOne = stored;

      await new ApiRepository(asService()).update('api-1', { apiUrl: 'https://new.example.com', requestLimit: 5 });

      assertStringIncludes(db.lastCall.sql, 'SET api_url = $1, request_limit = $2');
      assertStringIncludes(db.lastCall.sql, 'WHERE id = $3');
      assertEquals(db.lastCall.params, ['https://new.example.com', 5, 'api-1']);
    });

    it('can update every editable field', async () => {
      db.results.queryOne = stored;

      await new ApiRepository(asService()).update('api-1', {
        name: 'n',
        apiUrl: 'u',
        method: HttpMethod.POST,
        requestLimit: 0,
        requestLimitUnit: RequestLimitUnit.Day,
      });

      assertStringIncludes(
        db.lastCall.sql,
        'SET name = $1, api_url = $2, method = $3, request_limit = $4, request_limit_unit = $5',
      );
      assertEquals(db.lastCall.params, ['n', 'u', 'POST', 0, 'day', 'api-1']);
    });

    it('never updates the keys, even if the caller passes them', async () => {
      db.results.queryOne = stored;

      await new ApiRepository(asService()).update('api-1', {
        name: 'n',
        publicKey: 'hacked',
        privateKey: 'hacked',
      } as never);

      assertEquals(db.lastCall.params, ['n', 'api-1']);
    });
  });

  for (const [rowCount, expected] of [[1, true], [0, false]] as const) {
    it(`delete returns ${expected} when ${rowCount} rows are affected`, async () => {
      db.results.execute = rowCount;

      assertEquals(await new ApiRepository(asService()).delete('api-1'), expected);
      assertEquals(db.lastCall.params, ['api-1']);
    });
  }
});

describe('IpRepository', () => {
  const stored = { id: 'ip-1', ip: '1.2.3.4' };

  it('create inserts the address', async () => {
    db.results.queryOne = stored;

    assertEquals(await new IpRepository(asService()).create({ ip: '1.2.3.4' }), stored);
    assertEquals(db.lastCall.params, ['1.2.3.4']);
  });

  it('create throws when the database returns no row', async () => {
    await assertRejects(() => new IpRepository(asService()).create({ ip: '1.2.3.4' }), Error, 'Failed to create IP');
  });

  it('findById and findByIp bind their parameter', async () => {
    db.results.queryOne = stored;
    const repository = new IpRepository(asService());

    assertEquals(await repository.findById('ip-1'), stored);
    assertEquals(db.lastCall.params, ['ip-1']);
    assertEquals(await repository.findByIp('1.2.3.4'), stored);
    assertEquals(db.lastCall.params, ['1.2.3.4']);
  });

  it('findAll orders by address', async () => {
    db.results.query = [stored];

    assertEquals(await new IpRepository(asService()).findAll(), [stored]);
    assertStringIncludes(db.lastCall.sql, 'ORDER BY ip ASC');
  });

  it('update returns null when the IP does not exist', async () => {
    assertEquals(await new IpRepository(asService()).update('missing', { ip: '1.1.1.1' }), null);
    assertEquals(db.calls.length, 1);
  });

  it('update returns the existing IP when no address is given', async () => {
    db.results.queryOne = stored;

    assertEquals(await new IpRepository(asService()).update('ip-1', {}), stored);
    assertEquals(db.calls.length, 1);
  });

  it('update changes the address', async () => {
    db.results.queryOne = stored;

    await new IpRepository(asService()).update('ip-1', { ip: '1.1.1.1' });

    assertEquals(db.lastCall.params, ['1.1.1.1', 'ip-1']);
  });

  it('delete reports whether a row was removed', async () => {
    const repository = new IpRepository(asService());

    db.results.execute = 1;
    assertEquals(await repository.delete('ip-1'), true);
    db.results.execute = 0;
    assertEquals(await repository.delete('ip-1'), false);
  });
});

describe('IpUsageRepository', () => {
  const usage = { id: 'u-1', ipId: 'ip-1', apiId: 'api-1', lastUsedAt: 1000, requestLimitCounter: 3 };

  it('create stores the usage', async () => {
    db.results.queryOne = usage;

    await new IpUsageRepository(asService()).create({ ipId: 'ip-1', apiId: 'api-1', lastUsedAt: 1000, requestLimitCounter: 3 });

    assertEquals(db.lastCall.params, ['ip-1', 'api-1', 1000, 3]);
  });

  it('create defaults the counter to 0', async () => {
    db.results.queryOne = usage;

    await new IpUsageRepository(asService()).create({ ipId: 'ip-1', apiId: 'api-1', lastUsedAt: 1000 } as never);

    assertEquals(db.lastCall.params?.[3], 0);
  });

  it('create throws when the database returns no row', async () => {
    await assertRejects(
      () => new IpUsageRepository(asService()).create({ ipId: 'i', apiId: 'a', lastUsedAt: 1, requestLimitCounter: 0 }),
      Error,
      'Failed to create IP usage',
    );
  });

  it('single-row lookups bind their parameters', async () => {
    const repository = new IpUsageRepository(asService());

    await repository.findById('u-1');
    assertEquals(db.lastCall.params, ['u-1']);
    await repository.findByIpAndApi('ip-1', 'api-1');
    assertStringIncludes(db.lastCall.sql, 'WHERE ip_id = $1 AND api_id = $2');
    assertEquals(db.lastCall.params, ['ip-1', 'api-1']);
  });

  it('list lookups return rows, most recently used first', async () => {
    db.results.query = [usage];
    const repository = new IpUsageRepository(asService());

    assertEquals(await repository.findByIpId('ip-1'), [usage]);
    assertStringIncludes(db.lastCall.sql, 'ORDER BY last_used_at DESC');
    assertEquals(await repository.findByApiId('api-1'), [usage]);
    assertStringIncludes(db.lastCall.sql, 'WHERE api_id = $1');
    assertEquals(await repository.findAll(), [usage]);
    assertStringIncludes(db.lastCall.sql, 'ORDER BY last_used_at DESC');
  });

  it('updateLastUsedAt binds the timestamp and id', async () => {
    await new IpUsageRepository(asService()).updateLastUsedAt('u-1', 2000);

    assertEquals(db.lastCall.params, [2000, 'u-1']);
  });

  it('upsert updates the counter on conflict', async () => {
    db.results.queryOne = usage;

    assertEquals(await new IpUsageRepository(asService()).upsert('ip-1', 'api-1', 2000, 4), usage);
    assertStringIncludes(db.lastCall.sql, 'ON CONFLICT (ip_id, api_id) DO UPDATE');
    assertEquals(db.lastCall.params, ['ip-1', 'api-1', 2000, 4]);
  });

  it('upsert defaults the counter to 0', async () => {
    db.results.queryOne = usage;

    await new IpUsageRepository(asService()).upsert('ip-1', 'api-1', 2000);

    assertEquals(db.lastCall.params?.[3], 0);
  });

  it('upsert throws when the database returns no row', async () => {
    await assertRejects(
      () => new IpUsageRepository(asService()).upsert('ip-1', 'api-1', 2000),
      Error,
      'Failed to upsert IP usage',
    );
  });

  it('incrementCounter increases the stored value in SQL', async () => {
    db.results.queryOne = usage;

    await new IpUsageRepository(asService()).incrementCounter('ip-1', 'api-1');

    assertStringIncludes(db.lastCall.sql, 'request_limit_counter = request_limit_counter + 1');
    assertEquals(db.lastCall.params?.slice(0, 2), ['ip-1', 'api-1']);
  });

  it('incrementCounter throws when there is no row', async () => {
    await assertRejects(
      () => new IpUsageRepository(asService()).incrementCounter('ip-1', 'api-1'),
      Error,
      'Failed to increment counter',
    );
  });

  it('resetCounter sets the counter to 0', async () => {
    await new IpUsageRepository(asService()).resetCounter('ip-1', 'api-1');

    assertStringIncludes(db.lastCall.sql, 'SET request_limit_counter = 0');
    assertEquals(db.lastCall.params, ['ip-1', 'api-1']);
  });

  it('delete reports whether a row was removed', async () => {
    db.results.execute = 1;

    assertEquals(await new IpUsageRepository(asService()).delete('u-1'), true);
  });
});

describe('ConfigRepository', () => {
  const stored = { key: 'enableRegistration', value: 'true' };

  it('get binds the key', async () => {
    db.results.queryOne = stored;

    assertEquals(await new ConfigRepository(asService()).get('enableRegistration'), stored);
    assertEquals(db.lastCall.params, ['enableRegistration']);
  });

  it('set upserts the value', async () => {
    db.results.queryOne = stored;

    assertEquals(await new ConfigRepository(asService()).set('enableRegistration', 'true'), stored);
    assertStringIncludes(db.lastCall.sql, 'ON CONFLICT (key) DO UPDATE');
    assertEquals(db.lastCall.params, ['enableRegistration', 'true']);
  });

  it('set throws when the database returns no row', async () => {
    await assertRejects(() => new ConfigRepository(asService()).set('k', 'v'), Error, 'Failed to set config');
  });

  it('getAll returns every entry ordered by key', async () => {
    db.results.query = [stored];

    assertEquals(await new ConfigRepository(asService()).getAll(), [stored]);
    assertStringIncludes(db.lastCall.sql, 'ORDER BY key ASC');
  });
});

describe('RequestLogRepository', () => {
  it('create stores the log entry', async () => {
    await new RequestLogRepository(asService()).create({
      apiId: 'api-1',
      ipId: 'ip-1',
      errorMessage: 'boom',
      statusCode: 500,
      occurredAt: 1000,
    });

    assertEquals(db.lastCall.params, ['api-1', 'ip-1', 'boom', 500, 1000]);
  });

  it('create stores null for an unknown API and IP', async () => {
    await new RequestLogRepository(asService()).create({
      errorMessage: 'API not found',
      statusCode: 404,
      occurredAt: 1000,
    } as never);

    assertEquals(db.lastCall.params?.slice(0, 2), [null, null]);
  });

  it('findAll defaults to the 100 most recent entries', async () => {
    db.results.query = [{ id: 'log-1' }];

    assertEquals(await new RequestLogRepository(asService()).findAll(), [{ id: 'log-1' }] as never);
    assertStringIncludes(db.lastCall.sql, 'ORDER BY occurred_at DESC');
    assertEquals(db.lastCall.params, [100, 0]);
  });

  it('findAll applies limit and offset', async () => {
    await new RequestLogRepository(asService()).findAll(10, 20);

    assertEquals(db.lastCall.params, [10, 20]);
  });
});

describe('UserRepository', () => {
  const stored = { id: 'user-1', username: 'anna', email: 'a@example.com', password: 'hash', userRole: UserRole.Admin };

  it('create stores the given role', async () => {
    db.results.queryOne = stored;

    await new UserRepository(asService()).create({
      username: 'anna',
      email: 'a@example.com',
      password: 'hash',
      userRole: UserRole.Admin,
    } as never);

    assertEquals(db.lastCall.params, ['anna', 'a@example.com', 'hash', UserRole.Admin]);
  });

  it('create defaults to the User role', async () => {
    db.results.queryOne = stored;

    await new UserRepository(asService()).create({ username: 'anna', email: 'a@example.com', password: 'hash' } as never);

    assertEquals(db.lastCall.params?.[3], UserRole.User);
  });

  it('create throws when the database returns no row', async () => {
    await assertRejects(
      () => new UserRepository(asService()).create({ username: 'a', email: 'e', password: 'p' } as never),
      Error,
      'Failed to create user',
    );
  });

  const lookups: Array<[string, (repo: UserRepository) => Promise<unknown>, string, string]> = [
    ['findById', (repo) => repo.findById('user-1'), 'WHERE id = $1', 'user-1'],
    ['findByEmail', (repo) => repo.findByEmail('a@example.com'), 'WHERE email = $1', 'a@example.com'],
    ['findByUsername', (repo) => repo.findByUsername('anna'), 'WHERE username = $1', 'anna'],
  ];

  for (const [name, call, where, param] of lookups) {
    it(`${name} filters with a bound parameter`, async () => {
      db.results.queryOne = stored;

      assertEquals(await call(new UserRepository(asService())), stored);
      assertStringIncludes(db.lastCall.sql, where);
      assertEquals(db.lastCall.params, [param]);
    });
  }

  it('findAll returns the newest users first', async () => {
    db.results.query = [stored];

    assertEquals(await new UserRepository(asService()).findAll(), [stored] as never);
    assertStringIncludes(db.lastCall.sql, 'ORDER BY created_at DESC');
  });

  it('findByRole binds the role', async () => {
    await new UserRepository(asService()).findByRole(UserRole.SuperAdmin);

    assertEquals(db.lastCall.params, [UserRole.SuperAdmin]);
  });

  describe('update', () => {
    it('returns null when the user does not exist', async () => {
      assertEquals(await new UserRepository(asService()).update('missing', { username: 'x' }), null);
      assertEquals(db.calls.length, 1);
    });

    it('returns the existing user when there is nothing to change', async () => {
      db.results.queryOne = stored;

      assertEquals(await new UserRepository(asService()).update('user-1', {}), stored as never);
      assertEquals(db.calls.length, 1);
    });

    it('updates every provided field, numbering parameters in order', async () => {
      db.results.queryOne = stored;

      await new UserRepository(asService()).update('user-1', {
        username: 'u',
        email: 'e',
        password: 'p',
        userRole: UserRole.Moderator,
        accessToken: 't',
      } as never);

      assertStringIncludes(
        db.lastCall.sql,
        'SET username = $1, email = $2, password = $3, user_role = $4, access_token = $5',
      );
      assertStringIncludes(db.lastCall.sql, 'WHERE id = $6');
      assertEquals(db.lastCall.params, ['u', 'e', 'p', UserRole.Moderator, 't', 'user-1']);
    });
  });

  it('delete reports whether a row was removed', async () => {
    db.results.execute = 0;

    assertEquals(await new UserRepository(asService()).delete('user-1'), false);
  });
});
