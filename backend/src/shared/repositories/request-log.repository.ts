import { Injectable } from '@danet/core';
import { PostgresService } from '../database/postgres.service.ts';
import { RequestLog } from '@shared/models/request-log.model.ts';

@Injectable()
export class RequestLogRepository {
  public constructor(private readonly _postgresService: PostgresService) {}

  public async create(log: Omit<RequestLog, 'id'>): Promise<void> {
    const sql = `
      INSERT INTO request_logs (api_id, ip_id, error_message, status_code, occurred_at)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await this._postgresService.execute(sql, [
      log.apiId ?? null,
      log.ipId ?? null,
      log.errorMessage,
      log.statusCode,
      log.occurredAt,
    ]);
  }

  public async findAll(limit = 100, offset = 0): Promise<RequestLog[]> {
    const sql = `
      SELECT id, api_id as "apiId", ip_id as "ipId", error_message as "errorMessage",
             status_code as "statusCode", occurred_at as "occurredAt"
      FROM request_logs
      ORDER BY occurred_at DESC
      LIMIT $1 OFFSET $2
    `;
    return await this._postgresService.query<RequestLog>(sql, [limit, offset]);
  }
}
