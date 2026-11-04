// Seeds the initial SuperAdmin account from environment variables.
//
//   INITIAL_SUPERADMIN_USERNAME  (default: "superadmin")
//   INITIAL_SUPERADMIN_EMAIL     (required on a fresh install)
//   INITIAL_SUPERADMIN_PASSWORD  (required on a fresh install, must pass the password policy)
//
// Behaviour:
// - If any user already has the 'superadmin' role, nothing is created (existing
//   deployments that promoted a user manually are left untouched).
// - Otherwise the env vars are required. If they are missing or invalid the migration
//   throws, is NOT recorded as applied, and is retried on the next startup.
// - An existing non-superadmin user with the same username/email is never promoted
//   automatically; the migration fails instead so an operator can decide.
//
// This is a TypeScript migration because the password must be bcrypt-hashed and the
// credentials must come from the environment, neither of which plain SQL can do.

import type { MigrationClient } from '../migration-runner.ts';
import { PasswordService } from '../../services/password.service.ts';
import { UserRole } from '@shared/types/user-role.ts';

export default async function up(client: MigrationClient): Promise<void> {
  const existing = await client.queryObject<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM users WHERE user_role = $1',
    [UserRole.SuperAdmin],
  );
  if (existing.rows[0].count > 0) {
    console.log('    SuperAdmin already exists, skipping seed');
    return;
  }

  const username = Deno.env.get('INITIAL_SUPERADMIN_USERNAME')?.trim() || 'superadmin';
  const email = Deno.env.get('INITIAL_SUPERADMIN_EMAIL')?.trim();
  const password = Deno.env.get('INITIAL_SUPERADMIN_PASSWORD');

  if (!email || !password) {
    throw new Error(
      'No SuperAdmin exists. Set INITIAL_SUPERADMIN_EMAIL and INITIAL_SUPERADMIN_PASSWORD ' +
        '(optionally INITIAL_SUPERADMIN_USERNAME) and restart to seed the initial SuperAdmin.',
    );
  }

  const passwordService = new PasswordService();
  const validation = passwordService.validatePasswordStrength(password);
  if (!validation.isValid) {
    throw new Error(
      `INITIAL_SUPERADMIN_PASSWORD does not meet the password policy: ${validation.errors.join(', ')}`,
    );
  }

  const conflict = await client.queryObject<{ username: string }>(
    'SELECT username FROM users WHERE username = $1 OR email = $2',
    [username, email],
  );
  if (conflict.rows.length > 0) {
    throw new Error(
      `A non-SuperAdmin user with username "${username}" or email "${email}" already exists. ` +
        'Promote it manually or choose different INITIAL_SUPERADMIN_* values.',
    );
  }

  const hashedPassword = await passwordService.hashPassword(password);

  await client.queryObject(
    'INSERT INTO users (username, email, password, user_role) VALUES ($1, $2, $3, $4)',
    [username, email, hashedPassword, UserRole.SuperAdmin],
  );

  console.log(`    Initial SuperAdmin "${username}" created. Remove INITIAL_SUPERADMIN_PASSWORD from the environment.`);
}
