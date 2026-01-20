import { Module } from '@danet/core';
import { PostgresService } from './shared/database/postgres.service.ts';
import { RedirectExceptionFilter } from './shared/filters/redirect-exception.filter.ts';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter.ts';
import { AuthModule } from './modules/auth/auth.module.ts';
import { GatewayModule } from './modules/gateway/gateway.module.ts';
import { ApiManagerModule } from './modules/api-manager/api-manager.module.ts';
import { IpManagerModule } from './modules/ip-manager/ip-manager.module.ts';

@Module({
  imports: [AuthModule, GatewayModule, ApiManagerModule, IpManagerModule],
  injectables: [
    PostgresService,
    RedirectExceptionFilter,
    HttpExceptionFilter,
  ],
})
export class AppModule {}