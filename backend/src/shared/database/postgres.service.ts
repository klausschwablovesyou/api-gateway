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
    const client = await this._pool.connect();
    try {
      const result = await client.queryObject<T>(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  public async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  public async execute(sql: string, params?: any[]): Promise<number> {
    const client = await this._pool.connect();
    try {
      const result = await client.queryObject(sql, params);
      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }

  public async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this._pool.connect();
    try {
      await client.queryObject('BEGIN');
      const result = await callback(client);
      await client.queryObject('COMMIT');
      return result;
    } catch (error) {
      await client.queryObject('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this._pool.end();
  }
}
