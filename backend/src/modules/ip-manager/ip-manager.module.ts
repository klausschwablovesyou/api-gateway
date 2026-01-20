import { Module } from '@danet/core';
import { IpManagerController } from './ip-manager.controller.ts';
import { IpManagerService } from './ip-manager.service.ts';
import { IpRepository } from '../../shared/repositories/ip.repository.ts';
import { PostgresService } from '../../shared/database/postgres.service.ts';

@Module({
  controllers: [IpManagerController],
  injectables: [IpManagerService, IpRepository, PostgresService],
})
export class IpManagerModule {}
