import { Module, TokenInjector, GLOBAL_GUARD } from '@danet/core';
import { PostgresService } from './shared/database/postgres.service.ts';
import { RedirectExceptionFilter } from './shared/filters/redirect-exception.filter.ts';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter.ts';
import { TelegramModule } from './modules/telegram/telegram.module.ts';
import { AuthModule } from './modules/auth/auth.module.ts';
import { RolesGuard } from './shared/guards/roles.guard.ts';
import { JwtService } from './shared/services/jwt.service.ts';

@Module({
  imports: [TelegramModule, AuthModule],
  injectables: [
    PostgresService,
    RedirectExceptionFilter,
    HttpExceptionFilter,
  ],
})
export class AppModule {}