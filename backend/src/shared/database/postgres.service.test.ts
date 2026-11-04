import { beforeEach, describe, it } from '@std/testing/bdd';
import { assertEquals, assertRejects, assertStrictEquals } from '@std/assert';
import { PostgresService } from './postgres.service.ts';

type QueryHandler = (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>;

class FakeClient {
  public released = 0;
  public readonly statements: string[] = [];

  public constructor(private readonly _handler: QueryHandler) {}

  public queryObject(sql: string, params?: unknown[]) {
    this.statements.push(sql);
    return this._handler(sql, params);
  }

  public release(): void {
    this.released++;
  }
}

class FakePool {
  public connections = 0;
  public ended = false;

  public constructor(private readonly _clients: FakeClient[]) {}

  public connect(): Promise<FakeClient> {
    return Promise.resolve(this._clients[this.connections++]);
  }

  public end(): Promise<void> {
    this.ended = true;
    return Promise.resolve();
  }
}

/** The real constructor opens a connection pool, so the service is built around a fake one. */
function createService(pool: FakePool): PostgresService {
  const service = Object.create(PostgresService.prototype);
  service._pool = pool;
  return service;
}

function failWith(message: string, code?: string): QueryHandler {
  return () => {
    const error = new Error(message) as Error & { code?: string };
    error.code = code;
    return Promise.reject(error);
  };
}

const succeed: QueryHandler = () => Promise.resolve({ rows: [{ id: 1 }], rowCount: 1 });

describe('PostgresService', () => {
  describe('query', () => {
    it('returns the rows, forwards the parameters and releases the client', async () => {
      let received: unknown[] | undefined;
      const client = new FakeClient((_sql, params) => {
        received = params;
        return Promise.resolve({ rows: [{ id: 1 }, { id: 2 }] });
      });

      const rows = await createService(new FakePool([client])).query('SELECT 1', ['a']);

      assertEquals(rows, [{ id: 1 }, { id: 2 }]);
      assertEquals(received, ['a']);
      assertEquals(client.released, 1);
    });
  });

  describe('queryOne', () => {
    it('returns the first row', async () => {
      const client = new FakeClient(() => Promise.resolve({ rows: [{ id: 1 }, { id: 2 }] }));

      assertEquals(await createService(new FakePool([client])).queryOne('SELECT 1'), { id: 1 });
    });

    it('returns null when there are no rows', async () => {
      const client = new FakeClient(() => Promise.resolve({ rows: [] }));

      assertEquals(await createService(new FakePool([client])).queryOne('SELECT 1'), null);
    });
  });

  describe('execute', () => {
    it('returns the affected row count', async () => {
      const client = new FakeClient(() => Promise.resolve({ rows: [], rowCount: 3 }));

      assertEquals(await createService(new FakePool([client])).execute('DELETE'), 3);
    });

    it('returns 0 when the driver reports no row count', async () => {
      const client = new FakeClient(() => Promise.resolve({ rows: [] }));

      assertEquals(await createService(new FakePool([client])).execute('CREATE TABLE x'), 0);
    });
  });

  describe('connection retry', () => {
    const brokenConnections: Array<[string, QueryHandler]> = [
      ['EPIPE', failWith('write failed', 'EPIPE')],
      ['ECONNRESET', failWith('read failed', 'ECONNRESET')],
      ['a BrokenPipe message', failWith('BrokenPipe: stream closed')],
      ['a "Connection closed" message', failWith('Connection closed by server')],
      ['a "connection is closed" message', failWith('the connection is closed')],
    ];

    for (const [description, handler] of brokenConnections) {
      it(`retries once on a fresh client after ${description}`, async () => {
        const stale = new FakeClient(handler);
        const fresh = new FakeClient(succeed);
        const pool = new FakePool([stale, fresh]);

        assertEquals(await createService(pool).query('SELECT 1'), [{ id: 1 }]);
        assertEquals(pool.connections, 2);
        assertEquals(stale.released, 1);
        assertEquals(fresh.released, 1);
      });
    }

    it('gives up when the second attempt also hits a broken connection', async () => {
      const first = new FakeClient(failWith('first', 'EPIPE'));
      const second = new FakeClient(failWith('second', 'EPIPE'));
      const pool = new FakePool([first, second]);

      await assertRejects(() => createService(pool).query('SELECT 1'), Error, 'second');
      assertEquals(pool.connections, 2);
      assertEquals(second.released, 1);
    });

    it('does not retry other errors, and still releases the client', async () => {
      const client = new FakeClient(failWith('syntax error at or near "SELEC"'));
      const pool = new FakePool([client]);

      await assertRejects(() => createService(pool).query('SELEC 1'), Error, 'syntax error');
      assertEquals(pool.connections, 1);
      assertEquals(client.released, 1);
    });

    it('does not retry when a non-Error value is thrown', async () => {
      const client = new FakeClient(() => Promise.reject('plain failure'));
      const pool = new FakePool([client]);

      const thrown = await createService(pool).query('SELECT 1').catch((err) => err);

      assertEquals(thrown, 'plain failure');
      assertEquals(pool.connections, 1);
    });
  });

  describe('transaction', () => {
    it('wraps the callback in BEGIN and COMMIT and returns its result', async () => {
      const client = new FakeClient(succeed);

      const result = await createService(new FakePool([client])).transaction(async (tx) => {
        await tx.queryObject('INSERT');
        return 'done';
      });

      assertEquals(result, 'done');
      assertEquals(client.statements, ['BEGIN', 'INSERT', 'COMMIT']);
      assertEquals(client.released, 1);
    });

    it('rolls back and rethrows when the callback fails', async () => {
      const client = new FakeClient(succeed);
      const failure = new Error('migration failed');

      const thrown = await createService(new FakePool([client]))
        .transaction(() => Promise.reject(failure))
        .catch((err) => err);

      assertStrictEquals(thrown, failure);
      assertEquals(client.statements, ['BEGIN', 'ROLLBACK']);
      assertEquals(client.released, 1);
    });
  });

  describe('pool access', () => {
    let pool: FakePool;

    beforeEach(() => {
      pool = new FakePool([]);
    });

    it('exposes the pool', () => {
      assertStrictEquals(createService(pool).pool as unknown, pool);
    });

    it('close ends the pool', async () => {
      await createService(pool).close();

      assertEquals(pool.ended, true);
    });
  });
});
