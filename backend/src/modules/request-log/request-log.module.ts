import { Module } from '@danet/core';
import { RequestLogController } from './request-log.controller.ts';
import { RequestLogRepository } from '../../shared/repositories/request-log.repository.ts';
import { PostgresService } from '../../shared/database/postgres.service.ts';

@Module({
  controllers: [RequestLogController],
  injectables: [RequestLogRepository, PostgresService],
})
export class RequestLogModule {}
