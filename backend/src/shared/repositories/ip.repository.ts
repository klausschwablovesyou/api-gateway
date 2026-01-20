import { Injectable } from '@danet/core';
import { PostgresService } from '../database/postgres.service.ts';
import { Ip } from '@shared/models/ip.model.ts';

@Injectable()
export class IpRepository {
  public constructor(private readonly _postgresService: PostgresService) {}

  public async create(ip: Omit<Ip, 'id'>): Promise<Ip> {
    const sql = `
      INSERT INTO ips (ip)
      VALUES ($1)
      RETURNING id, ip
    `;

    const result = await this._postgresService.queryOne<Ip>(sql, [ip.ip]);

    if (!result) {
      throw new Error('Failed to create IP');
    }

    return result;
  }

  public async findById(id: string): Promise<Ip | null> {
    const sql = `
      SELECT id, ip
      FROM ips
      WHERE id = $1
    `;
    return await this._postgresService.queryOne<Ip>(sql, [id]);
  }

  public async findByIp(ip: string): Promise<Ip | null> {
    const sql = `
      SELECT id, ip
      FROM ips
      WHERE ip = $1
    `;
    return await this._postgresService.queryOne<Ip>(sql, [ip]);
  }

  public async findAll(): Promise<Ip[]> {
    const sql = `
      SELECT id, ip
      FROM ips
      ORDER BY ip ASC
    `;
    return await this._postgresService.query<Ip>(sql);
  }

  public async update(id: string, updates: Partial<Omit<Ip, 'id'>>): Promise<Ip | null> {
    const existingIp = await this.findById(id);
    if (!existingIp) return null;

    if (updates.ip === undefined) {
      return existingIp;
    }

    const sql = `
      UPDATE ips
      SET ip = $1
      WHERE id = $2
      RETURNING id, ip
    `;

    return await this._postgresService.queryOne<Ip>(sql, [updates.ip, id]);
  }

  public async delete(id: string): Promise<boolean> {
    const sql = 'DELETE FROM ips WHERE id = $1';
    const rowCount = await this._postgresService.execute(sql, [id]);
    return rowCount > 0;
  }
}
