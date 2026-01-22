import { DanetApplication } from '@danet/core';
import { load } from '@std/dotenv';
import { AppModule } from './src/app.module.ts';
import { existsSync } from 'jsr:@std/fs';
import { PostgresService } from './src/shared/database/postgres.service.ts';
import { MigrationRunner } from './src/shared/database/migration-runner.ts';
import { FileLoggerService } from './src/shared/logger/file-logger.service.ts';
import { IpSyncService } from './src/shared/services/ip-sync.service.ts';

// Initialize file logger first (before any console.log calls)
const fileLogger = new FileLoggerService();
await fileLogger.initialize();

// Load environment variables from .env file (if it exists)
const envPath = '../.env';
if (existsSync(envPath)) {
  await load({ envPath, export: true });
}

// Run database migrations before app initialization
try {
  console.log('Initializing database...');
  const postgresService = new PostgresService();
  const migrationRunner = new MigrationRunner(postgresService, Deno.env.get('APP_NAME'));
  await migrationRunner.runMigrations();
  console.log('Database migrations completed successfully!');
} catch (error) {
  console.error('Failed to run database migrations:', error);
  console.warn('Application will continue, but database may not be initialized.');
}

const application = new DanetApplication();
application.registerBasePath('/api');

await application.init(AppModule);

// Sync IPs from database to network interface (for IP rotation)
const syncIps = Deno.env.get('SYNC_IPS_ON_STARTUP') !== 'false';
if (syncIps) {
  try {
    const ipSyncService = await application.get(IpSyncService);
    await ipSyncService.syncIpsToNetwork();
  } catch (error) {
    console.error('[IpSync] Failed to sync IPs on startup:', error);
  }
}

// Use different static assets path based on environment
// Register static assets AFTER app initialization so API routes take priority
const isDevelopment = Deno.env.get('DENO_ENV') !== 'production';
const staticAssetsPath = isDevelopment
  ? `${Deno.cwd()}/../client/dist/client/browser`
  : `${Deno.cwd()}/../public`;

application.useStaticAssets(staticAssetsPath);

// SPA fallback middleware - serve index.html for non-API routes that don't match static files
function createSpaFallbackMiddleware(assetsPath: string) {
  return async (ctx: { request: { url: { pathname: string } }; response: { status: number; body: string; headers: Headers } }, next: () => Promise<void>) => {
    await next();

    if (ctx.response.status === 404 && !ctx.request.url.pathname.startsWith('/api')) {
      try {
        const indexPath = `${assetsPath}/index.html`;
        const content = await Deno.readTextFile(indexPath);
        ctx.response.body = content;
        ctx.response.headers.set('Content-Type', 'text/html');
        ctx.response.status = 200;
      } catch {
        // If index.html doesn't exist, let it 404
      }
    }
  };
}

application.addMiddleware(createSpaFallbackMiddleware(staticAssetsPath));

const port = Number(Deno.env.get('PORT') || Deno.env.get('SERVER_PORT')) || 3000;
const hostname = '0.0.0.0'; // Listen on all interfaces for Docker

await application.listen(port, hostname);

console.log(`Server running on http://${hostname}:${port}`);