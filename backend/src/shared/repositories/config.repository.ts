import { Injectable } from '@danet/core';
import { PostgresService } from '../database/postgres.service.ts';
import { Config } from '@shared/models/config.model.ts';

@Injectable()
export class ConfigRepository {
  public constructor(private readonly _postgresService: PostgresService) {}

  public async get(key: string): Promise<Config | null> {
    const sql = `
      SELECT key, value
      FROM config
      WHERE key = $1
    `;
    return await this._postgresService.queryOne<Config>(sql, [key]);
  }

  public async set(key: string, value: string): Promise<Config> {
    const sql = `
      INSERT INTO config (key, value, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
      RETURNING key, value
    `;

    const result = await this._postgresService.queryOne<Config>(sql, [key, value]);

    if (!result) {
      throw new Error('Failed to set config');
    }

    return result;
  }

  public async getAll(): Promise<Config[]> {
    const sql = `
      SELECT key, value
      FROM config
      ORDER BY key ASC
    `;
    return await this._postgresService.query<Config>(sql);
  }
}
