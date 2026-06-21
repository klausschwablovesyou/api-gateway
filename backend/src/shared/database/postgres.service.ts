import { Injectable } from '@danet/core';
import { Pool } from '@db/postgres';

@Injectable()
export class PostgresService {
  private readonly _pool: Pool;

  constructor() {
    const dbHost = Deno.env.get('DB_HOST');
    const dbPort = parseInt(Deno.env.get('DB_PORT'));
    const dbName = Deno.env.get('DB_NAME');
    const dbUser = Deno.env.get('DB_USER');
    const dbPassword = Deno.env.get('DB_PASSWORD');
    const dbPoolSize = parseInt(Deno.env.get('DB_POOL_SIZE') || '10');

    this._pool = new Pool({
      hostname: dbHost,
      port: dbPort,
      database: dbName,
      user: dbUser,
      password: dbPassword
    }, dbPoolSize);

    console.log(`PostgreSQL pool initialized: ${dbUser}@${dbHost}:${dbPort}/${dbName}`);
  }

  public get pool(): Pool {
    return this._pool;
  }

  public async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return await this._withRetry(async (client) => {
      const result = await client.queryObject<T>(sql, params);
      return result.rows;
    });
  }

  public async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  public async execute(sql: string, params?: any[]): Promise<number> {
    return await this._withRetry(async (client) => {
      const result = await client.queryObject(sql, params);
      return result.rowCount || 0;
    });
  }

  public async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    return await this._withRetry(async (client) => {
      try {
        await client.queryObject('BEGIN');
        const result = await callback(client);
        await client.queryObject('COMMIT');
        return result;
      } catch (error) {
        await client.queryObject('ROLLBACK');
        throw error;
      }
    });
  }

  private async _withRetry<T>(fn: (client: any) => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      const client = await this._pool.connect();
      try {
        return await fn(client);
      } catch (err) {
        lastErr = err;
        if (attempt === 0 && this._isBrokenConnection(err)) {
          continue;
        }
        throw err;
      } finally {
        client.release();
      }
    }
    throw lastErr;
  }

  private _isBrokenConnection(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const code = (err as any).code;
    return code === 'EPIPE' || code === 'ECONNRESET' ||
      err.message.includes('BrokenPipe') ||
      err.message.includes('Connection closed') ||
      err.message.includes('connection is closed');
  }

  public async close(): Promise<void> {
    await this._pool.end();
  }
}
