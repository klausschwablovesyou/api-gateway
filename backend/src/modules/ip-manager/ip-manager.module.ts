import { Module } from '@danet/core';
import { IpManagerController } from './ip-manager.controller.ts';
import { IpManagerService } from './ip-manager.service.ts';
import { IpRepository } from '../../shared/repositories/ip.repository.ts';
import { IpSyncService } from '../../shared/services/ip-sync.service.ts';
import { PostgresService } from '../../shared/database/postgres.service.ts';

@Module({
  controllers: [IpManagerController],
  injectables: [IpManagerService, IpRepository, IpSyncService, PostgresService],
})
export class IpManagerModule {}
