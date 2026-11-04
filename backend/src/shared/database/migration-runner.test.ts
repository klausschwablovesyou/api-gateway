import { describe, it } from '@std/testing/bdd';
import { assert, assertEquals, assertRejects } from '@std/assert';
import { MigrationClient, MigrationRunner } from './migration-runner.ts';
import { PostgresService } from './postgres.service.ts';
import { useSilentConsole, withEnv } from '../../testing/test-helpers.ts';

const MIGRATIONS_DIR = new URL('./migrations/', import.meta.url);

async function listMigrationFiles(): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of Deno.readDir(MIGRATIONS_DIR)) {
    files.push(entry.name);
  }
  return files.sort();
}

/** Records what the runner does. `SELECT COUNT` reports an existing SuperAdmin, so the seed migration is a no-op. */
class FakeDatabase {
  public readonly executed: string[] = [];
  public readonly recorded: unknown[][] = [];
  public transactions = 0;

  public constructor(private readonly _applied: string[] = [], private readonly _superAdmins = 1) {}

  public asService(): PostgresService {
    return {
      execute: (sql: string) => {
        this.executed.push(sql);
        return Promise.resolve(0);
      },
      queryOne: (_sql: string, params: unknown[]) =>
        Promise.resolve(this._applied.includes(params[0] as string) ? { name: params[0] } : null),
      transaction: (callback: (client: MigrationClient) => Promise<unknown>) => {
        this.transactions++;
        return callback(this._client());
      },
    } as unknown as PostgresService;
  }

  private _client(): MigrationClient {
    return {
      queryObject: <T>(sql: string, args?: unknown[]) => {
        this.executed.push(sql);
        if (sql.startsWith('INSERT INTO migrations')) {
          this.recorded.push(args ?? []);
        }
        const rows = sql.includes('COUNT(*)') ? [{ count: this._superAdmins }] : [];
        return Promise.resolve({ rows: rows as T[] });
      },
    };
  }
}

describe('MigrationRunner', () => {
  useSilentConsole();

  it('finds only migration files in the migrations directory', async () => {
    for (const file of await listMigrationFiles()) {
      assert(
        /^\d{3}_[a-z0-9_]+\.(sql|ts)$/.test(file),
        `${file} would be executed as a migration; test files must not be placed in this directory`,
      );
    }
  });

  it('creates the tracking table before running migrations', async () => {
    const database = new FakeDatabase();

    await new MigrationRunner(database.asService(), 'app').runMigrations();

    assert(database.executed[0].includes('CREATE TABLE IF NOT EXISTS migrations'));
  });

  it('runs every pending migration in filename order, each in its own transaction', async () => {
    const database = new FakeDatabase();
    const files = await listMigrationFiles();

    await new MigrationRunner(database.asService(), 'app').runMigrations();

    assertEquals(database.transactions, files.length);
    assertEquals(database.recorded, files.map((file) => [file, 'app']));
  });

  it('skips migrations that were already applied', async () => {
    const files = await listMigrationFiles();
    const database = new FakeDatabase(files.slice(0, -1));

    await new MigrationRunner(database.asService(), 'app').runMigrations();

    assertEquals(database.transactions, 1);
    assertEquals(database.recorded, [[files[files.length - 1], 'app']]);
  });

  it('runs nothing when every migration was applied', async () => {
    const database = new FakeDatabase(await listMigrationFiles());

    await new MigrationRunner(database.asService(), 'app').runMigrations();

    assertEquals(database.transactions, 0);
  });

  it('executes the contents of a SQL migration', async () => {
    const files = await listMigrationFiles();
    const target = files.find((file) => file.endsWith('.sql'))!;
    const sql = await Deno.readTextFile(new URL(target, MIGRATIONS_DIR));
    const database = new FakeDatabase(files.filter((file) => file !== target));

    await new MigrationRunner(database.asService(), 'app').runMigrations();

    assert(database.executed.includes(sql));
  });

  it('does not record a TypeScript migration that fails, and stops the run', async () => {
    const restore = withEnv({ INITIAL_SUPERADMIN_EMAIL: undefined, INITIAL_SUPERADMIN_PASSWORD: undefined });
    const database = new FakeDatabase([], 0);

    try {
      await assertRejects(
        () => new MigrationRunner(database.asService(), 'app').runMigrations(),
        Error,
        'No SuperAdmin exists',
      );
    } finally {
      restore();
    }

    assert(!database.recorded.some(([name]) => String(name).endsWith('.ts')));
  });
});
