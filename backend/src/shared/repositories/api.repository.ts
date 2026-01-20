import { Injectable } from '@danet/core';
import { PostgresService } from '../database/postgres.service.ts';
import { Api } from '@shared/models/api.model.ts';

@Injectable()
export class ApiRepository {
  public constructor(private readonly _postgresService: PostgresService) {}

  public async create(api: Omit<Api, 'id'>): Promise<Api> {
    const sql = `
      INSERT INTO apis (name, api_url, method, public_key, private_key, request_limit, request_limit_unit)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, api_url as "apiUrl", method, public_key as "publicKey", private_key as "privateKey",
                request_limit as "requestLimit", request_limit_unit as "requestLimitUnit"
    `;

    const result = await this._postgresService.queryOne<Api>(sql, [
      api.name,
      api.apiUrl,
      api.method,
      api.publicKey,
      api.privateKey,
      api.requestLimit,
      api.requestLimitUnit,
    ]);

    if (!result) {
      throw new Error('Failed to create API');
    }

    return result;
  }

  public async findById(id: string): Promise<Api | null> {
    const sql = `
      SELECT id, name, api_url as "apiUrl", method, public_key as "publicKey", private_key as "privateKey",
             request_limit as "requestLimit", request_limit_unit as "requestLimitUnit"
      FROM apis
      WHERE id = $1
    `;
    return await this._postgresService.queryOne<Api>(sql, [id]);
  }

  public async findByName(name: string): Promise<Api | null> {
    const sql = `
      SELECT id, name, api_url as "apiUrl", method, public_key as "publicKey", private_key as "privateKey",
             request_limit as "requestLimit", request_limit_unit as "requestLimitUnit"
      FROM apis
      WHERE name = $1
    `;
    return await this._postgresService.queryOne<Api>(sql, [name]);
  }

  public async findByPublicKey(publicKey: string): Promise<Api | null> {
    const sql = `
      SELECT id, name, api_url as "apiUrl", method, public_key as "publicKey", private_key as "privateKey",
             request_limit as "requestLimit", request_limit_unit as "requestLimitUnit"
      FROM apis
      WHERE public_key = $1
    `;
    return await this._postgresService.queryOne<Api>(sql, [publicKey]);
  }

  public async findAll(): Promise<Api[]> {
    const sql = `
      SELECT id, name, api_url as "apiUrl", method, public_key as "publicKey", private_key as "privateKey",
             request_limit as "requestLimit", request_limit_unit as "requestLimitUnit"
      FROM apis
      ORDER BY name ASC
    `;
    return await this._postgresService.query<Api>(sql);
  }

  public async update(id: string, updates: Partial<Omit<Api, 'id' | 'publicKey' | 'privateKey'>>): Promise<Api | null> {
    const existingApi = await this.findById(id);
    if (!existingApi) return null;

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }
    if (updates.apiUrl !== undefined) {
      setClauses.push(`api_url = $${paramIndex++}`);
      params.push(updates.apiUrl);
    }
    if (updates.method !== undefined) {
      setClauses.push(`method = $${paramIndex++}`);
      params.push(updates.method);
    }
    if (updates.requestLimit !== undefined) {
      setClauses.push(`request_limit = $${paramIndex++}`);
      params.push(updates.requestLimit);
    }
    if (updates.requestLimitUnit !== undefined) {
      setClauses.push(`request_limit_unit = $${paramIndex++}`);
      params.push(updates.requestLimitUnit);
    }

    if (setClauses.length === 0) {
      return existingApi;
    }

    params.push(id);

    const sql = `
      UPDATE apis
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, api_url as "apiUrl", method, public_key as "publicKey", private_key as "privateKey",
                request_limit as "requestLimit", request_limit_unit as "requestLimitUnit"
    `;

    return await this._postgresService.queryOne<Api>(sql, params);
  }

  public async delete(id: string): Promise<boolean> {
    const sql = 'DELETE FROM apis WHERE id = $1';
    const rowCount = await this._postgresService.execute(sql, [id]);
    return rowCount > 0;
  }
}
