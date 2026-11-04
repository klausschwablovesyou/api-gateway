// This test lives outside migrations/ on purpose: MigrationRunner executes every .ts file in that directory.
import { afterEach, describe, it } from '@std/testing/bdd';
import { assert, assertEquals, assertRejects, assertStringIncludes } from '@std/assert';
import up from './migrations/011_seed_initial_superadmin.ts';
import { MigrationClient } from './migration-runner.ts';
import { PasswordService } from '../services/password.service.ts';
import { UserRole } from '@shared/types/user-role.ts';
import { useSilentConsole, withEnv } from '../../testing/test-helpers.ts';

const VALID_PASSWORD = 'Str0ng!pass';

function createClient(options: { superAdmins?: number; conflict?: boolean } = {}) {
  const queries: Array<{ sql: string; args?: unknown[] }> = [];
  const client: MigrationClient = {
    queryObject: <T>(sql: string, args?: unknown[]) => {
      queries.push({ sql, args });
      let rows: unknown[] = [];
      if (sql.includes('COUNT(*)')) {
        rows = [{ count: options.superAdmins ?? 0 }];
      } else if (sql.startsWith('SELECT username') && options.conflict) {
        rows = [{ username: 'superadmin' }];
      }
      return Promise.resolve({ rows: rows as T[] });
    },
  };

  return { client, queries, inserts: () => queries.filter((query) => query.sql.startsWith('INSERT')) };
}

describe('011_seed_initial_superadmin', () => {
  useSilentConsole();

  let restoreEnv: (() => void) | undefined;

  function setEnv(values: { username?: string; email?: string; password?: string }): void {
    restoreEnv = withEnv({
      INITIAL_SUPERADMIN_USERNAME: values.username,
      INITIAL_SUPERADMIN_EMAIL: values.email,
      INITIAL_SUPERADMIN_PASSWORD: values.password,
    });
  }

  afterEach(() => {
    restoreEnv?.();
    restoreEnv = undefined;
  });

  it('does nothing when a SuperAdmin already exists, even without credentials', async () => {
    setEnv({});
    const { client, inserts, queries } = createClient({ superAdmins: 1 });

    await up(client);

    assertEquals(inserts().length, 0);
    assertEquals(queries[0].args, [UserRole.SuperAdmin]);
  });

  it('fails when the email is missing', async () => {
    setEnv({ password: VALID_PASSWORD });
    const { client, inserts } = createClient();

    await assertRejects(() => up(client), Error, 'INITIAL_SUPERADMIN_EMAIL');
    assertEquals(inserts().length, 0);
  });

  it('fails when the password is missing', async () => {
    setEnv({ email: 'root@example.com' });
    const { client, inserts } = createClient();

    await assertRejects(() => up(client), Error, 'INITIAL_SUPERADMIN_PASSWORD');
    assertEquals(inserts().length, 0);
  });

  it('fails when the email is only whitespace', async () => {
    setEnv({ email: '   ', password: VALID_PASSWORD });
    const { client } = createClient();

    await assertRejects(() => up(client), Error, 'No SuperAdmin exists');
  });

  it('fails when the password does not meet the policy', async () => {
    setEnv({ email: 'root@example.com', password: 'weak' });
    const { client, inserts } = createClient();

    await assertRejects(() => up(client), Error, 'does not meet the password policy');
    assertEquals(inserts().length, 0);
  });

  it('never promotes an existing user with the same username or email', async () => {
    setEnv({ email: 'root@example.com', password: VALID_PASSWORD });
    const { client, inserts } = createClient({ conflict: true });

    await assertRejects(() => up(client), Error, 'already exists');
    assertEquals(inserts().length, 0);
  });

  it('creates the SuperAdmin with a hashed password and the default username', async () => {
    setEnv({ email: 'root@example.com', password: VALID_PASSWORD });
    const { client, inserts } = createClient();

    await up(client);

    assertEquals(inserts().length, 1);
    const [username, email, hash, role] = inserts()[0].args as string[];
    assertEquals(username, 'superadmin');
    assertEquals(email, 'root@example.com');
    assertEquals(role, UserRole.SuperAdmin);
    assertStringIncludes(hash, '$2');
    assert(await new PasswordService().verifyPassword(VALID_PASSWORD, hash));
  });

  it('uses the configured username and trims the username and email', async () => {
    setEnv({ username: '  root  ', email: '  root@example.com ', password: VALID_PASSWORD });
    const { client, inserts } = createClient();

    await up(client);

    const [username, email] = inserts()[0].args as string[];
    assertEquals(username, 'root');
    assertEquals(email, 'root@example.com');
  });
});
