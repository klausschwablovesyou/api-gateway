import { Module } from '@danet/core';
import { GatewayController } from './gateway.controller.ts';
import { GatewayService } from './gateway.service.ts';
import { ApiRepository } from '../../shared/repositories/api.repository.ts';
import { IpRepository } from '../../shared/repositories/ip.repository.ts';
import { IpUsageRepository } from '../../shared/repositories/ip-usage.repository.ts';
import { ApiKeyService } from '../../shared/services/api-key.service.ts';
import { PostgresService } from '../../shared/database/postgres.service.ts';
import { RequestLogRepository } from '../../shared/repositories/request-log.repository.ts';
import { RealtimeService } from '../realtime/realtime.service.ts';

@Module({
  controllers: [GatewayController],
  injectables: [GatewayService, ApiRepository, IpRepository, IpUsageRepository, ApiKeyService, PostgresService, RequestLogRepository, RealtimeService],
})
export class GatewayModule {}
