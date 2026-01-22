import { Module } from '@danet/core';
import { ConfigManagerController } from './config-manager.controller.ts';
import { ConfigManagerService } from './config-manager.service.ts';
import { ConfigRepository } from '../../shared/repositories/config.repository.ts';
import { PostgresService } from '../../shared/database/postgres.service.ts';

@Module({
  controllers: [ConfigManagerController],
  injectables: [ConfigManagerService, ConfigRepository, PostgresService],
})
export class ConfigManagerModule {}
