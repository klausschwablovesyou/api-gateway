import { PostgresService } from './postgres.service.ts';

export class MigrationRunner {
  constructor(
    private readonly _postgresService: PostgresService,
    private readonly _appName: string = 'telegrambot'
  ) {}

  public async runMigrations(): Promise<void> {
    console.log(`Running database migrations for app: ${this._appName}...`);

    // Create migrations tracking table
    await this.createMigrationsTable();

    // Discover migration files dynamically
    const migrationsDir = new URL('./migrations/', import.meta.url);
    const migrations: string[] = [];

    for await (const entry of Deno.readDir(migrationsDir)) {
      if (entry.isFile && entry.name.endsWith('.sql')) {
        migrations.push(entry.name);
      }
    }

    // Sort migrations by filename (001_, 002_, 003_, etc.)
    migrations.sort();

    for (const migrationFile of migrations) {
      await this.runMigration(migrationFile);
    }

    console.log('All migrations completed successfully!');
  }

  private async createMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        app VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT migrations_app_name_unique UNIQUE (app, name)
      )
    `;
    await this._postgresService.execute(sql);

    // Create index for faster lookups by app
    /* await this._postgresService.execute(
      'CREATE INDEX IF NOT EXISTS idx_migrations_app ON migrations(app)'
    ); */
  }

  private async runMigration(filename: string): Promise<void> {
    // Check if migration already ran for this app
    const existing = await this._postgresService.queryOne<{ name: string }>(
      'SELECT name FROM migrations WHERE name = $1 AND app = $2',
      [filename, this._appName]
    );

    if (existing) {
      console.log(`  ✓ Migration ${filename} already applied`);
      return;
    }

    console.log(`  → Running migration ${filename}...`);

    // Read migration file
    const migrationPath = new URL(`./migrations/${filename}`, import.meta.url);
    const sql = await Deno.readTextFile(migrationPath);

    // Execute migration in transaction
    await this._postgresService.transaction(async (client) => {
      await client.queryObject(sql);
      await client.queryObject(
        'INSERT INTO migrations (name, app) VALUES ($1, $2)',
        [filename, this._appName]
      );
    });

    console.log(`  ✓ Migration ${filename} completed`);
  }
}
