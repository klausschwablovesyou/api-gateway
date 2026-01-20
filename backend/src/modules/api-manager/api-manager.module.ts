import { Module } from '@danet/core';
import { ApiManagerController } from './api-manager.controller.ts';
import { ApiManagerService } from './api-manager.service.ts';
import { ApiRepository } from '../../shared/repositories/api.repository.ts';
import { ApiKeyService } from '../../shared/services/api-key.service.ts';
import { PostgresService } from '../../shared/database/postgres.service.ts';

@Module({
  controllers: [ApiManagerController],
  injectables: [ApiManagerService, ApiRepository, ApiKeyService, PostgresService],
})
export class ApiManagerModule {}
