import { Injectable } from '@danet/core';
import { PostgresService } from '../database/postgres.service.ts';
import { IpUsage } from '@shared/models/ip-usage.model.ts';

@Injectable()
export class IpUsageRepository {
  public constructor(private readonly _postgresService: PostgresService) {}

  public async create(ipUsage: Omit<IpUsage, 'id'>): Promise<IpUsage> {
    const sql = `
      INSERT INTO ip_usage (ip_id, api_id, last_used_at, request_limit_counter)
      VALUES ($1, $2, $3, $4)
      RETURNING id, ip_id as "ipId", api_id as "apiId", last_used_at as "lastUsedAt", request_limit_counter as "requestLimitCounter"
    `;

    const result = await this._postgresService.queryOne<IpUsage>(sql, [
      ipUsage.ipId,
      ipUsage.apiId,
      ipUsage.lastUsedAt,
      ipUsage.requestLimitCounter ?? 0,
    ]);

    if (!result) {
      throw new Error('Failed to create IP usage');
    }

    return result;
  }

  public async findById(id: string): Promise<IpUsage | null> {
    const sql = `
      SELECT id, ip_id as "ipId", api_id as "apiId", last_used_at as "lastUsedAt", request_limit_counter as "requestLimitCounter"
      FROM ip_usage
      WHERE id = $1
    `;
    return await this._postgresService.queryOne<IpUsage>(sql, [id]);
  }

  public async findByIpAndApi(ipId: string, apiId: string): Promise<IpUsage | null> {
    const sql = `
      SELECT id, ip_id as "ipId", api_id as "apiId", last_used_at as "lastUsedAt", request_limit_counter as "requestLimitCounter"
      FROM ip_usage
      WHERE ip_id = $1 AND api_id = $2
    `;
    return await this._postgresService.queryOne<IpUsage>(sql, [ipId, apiId]);
  }

  public async findByIpId(ipId: string): Promise<IpUsage[]> {
    const sql = `
      SELECT id, ip_id as "ipId", api_id as "apiId", last_used_at as "lastUsedAt", request_limit_counter as "requestLimitCounter"
      FROM ip_usage
      WHERE ip_id = $1
      ORDER BY last_used_at DESC
    `;
    return await this._postgresService.query<IpUsage>(sql, [ipId]);
  }

  public async findByApiId(apiId: string): Promise<IpUsage[]> {
    const sql = `
      SELECT id, ip_id as "ipId", api_id as "apiId", last_used_at as "lastUsedAt", request_limit_counter as "requestLimitCounter"
      FROM ip_usage
      WHERE api_id = $1
      ORDER BY last_used_at DESC
    `;
    return await this._postgresService.query<IpUsage>(sql, [apiId]);
  }

  public async findAll(): Promise<IpUsage[]> {
    const sql = `
      SELECT id, ip_id as "ipId", api_id as "apiId", last_used_at as "lastUsedAt", request_limit_counter as "requestLimitCounter"
      FROM ip_usage
      ORDER BY last_used_at DESC
    `;
    return await this._postgresService.query<IpUsage>(sql);
  }

  public async updateLastUsedAt(id: string, lastUsedAt: number): Promise<IpUsage | null> {
    const sql = `
      UPDATE ip_usage
      SET last_used_at = $1
      WHERE id = $2
      RETURNING id, ip_id as "ipId", api_id as "apiId", last_used_at as "lastUsedAt", request_limit_counter as "requestLimitCounter"
    `;
    return await this._postgresService.queryOne<IpUsage>(sql, [lastUsedAt, id]);
  }

  public async upsert(ipId: string, apiId: string, lastUsedAt: number, requestLimitCounter: number = 0): Promise<IpUsage> {
    const sql = `
      INSERT INTO ip_usage (ip_id, api_id, last_used_at, request_limit_counter)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (ip_id, api_id) DO UPDATE SET last_used_at = $3, request_limit_counter = $4
      RETURNING id, ip_id as "ipId", api_id as "apiId", last_used_at as "lastUsedAt", request_limit_counter as "requestLimitCounter"
    `;

    const result = await this._postgresService.queryOne<IpUsage>(sql, [ipId, apiId, lastUsedAt, requestLimitCounter]);

    if (!result) {
      throw new Error('Failed to upsert IP usage');
    }

    return result;
  }

  public async incrementCounter(ipId: string, apiId: string): Promise<IpUsage> {
    const sql = `
      UPDATE ip_usage
      SET request_limit_counter = request_limit_counter + 1, last_used_at = $3
      WHERE ip_id = $1 AND api_id = $2
      RETURNING id, ip_id as "ipId", api_id as "apiId", last_used_at as "lastUsedAt", request_limit_counter as "requestLimitCounter"
    `;

    const result = await this._postgresService.queryOne<IpUsage>(sql, [ipId, apiId, Date.now()]);

    if (!result) {
      throw new Error('Failed to increment counter');
    }

    return result;
  }

  public async resetCounter(ipId: string, apiId: string): Promise<IpUsage | null> {
    const sql = `
      UPDATE ip_usage
      SET request_limit_counter = 0
      WHERE ip_id = $1 AND api_id = $2
      RETURNING id, ip_id as "ipId", api_id as "apiId", last_used_at as "lastUsedAt", request_limit_counter as "requestLimitCounter"
    `;
    return await this._postgresService.queryOne<IpUsage>(sql, [ipId, apiId]);
  }

  public async delete(id: string): Promise<boolean> {
    const sql = 'DELETE FROM ip_usage WHERE id = $1';
    const rowCount = await this._postgresService.execute(sql, [id]);
    return rowCount > 0;
  }
}
