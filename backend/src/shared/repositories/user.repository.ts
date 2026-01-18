import { Injectable } from '@danet/core';
import { PostgresService } from '../database/postgres.service.ts';
import { User } from '@shared/models/user.model.ts';
import { UserRole } from '@shared/types/user-role';

@Injectable()
export class UserRepository {
  public constructor(private readonly _postgresService: PostgresService) {}

  public async create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const sql = `
      INSERT INTO users (username, email, password, user_role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, email, password, user_role as "userRole", created_at as "createdAt", updated_at as "updatedAt"
    `;

    const result = await this._postgresService.queryOne<User>(sql, [
      user.username,
      user.email,
      user.password,
      user.userRole || UserRole.User
    ]);

    if (!result) {
      throw new Error('Failed to create user');
    }

    return result;
  }

  public async findById(id: string): Promise<User | null> {
    const sql = `
      SELECT id, username, email, password, user_role as "userRole", access_token as "accessToken", created_at as "createdAt", updated_at as "updatedAt"
      FROM users
      WHERE id = $1
    `;
    return await this._postgresService.queryOne<User>(sql, [id]);
  }

  public async findByEmail(email: string): Promise<User | null> {
    const sql = `
      SELECT id, username, email, password, user_role as "userRole", access_token as "accessToken", created_at as "createdAt", updated_at as "updatedAt"
      FROM users
      WHERE email = $1
    `;
    return await this._postgresService.queryOne<User>(sql, [email]);
  }

  public async findByUsername(username: string): Promise<User | null> {
    const sql = `
      SELECT id, username, email, password, user_role as "userRole", access_token as "accessToken", created_at as "createdAt", updated_at as "updatedAt"
      FROM users
      WHERE username = $1
    `;
    return await this._postgresService.queryOne<User>(sql, [username]);
  }

  public async update(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | null> {
    const existingUser = await this.findById(id);
    if (!existingUser) return null;

    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.username !== undefined) {
      setClauses.push(`username = $${paramIndex++}`);
      params.push(updates.username);
    }
    if (updates.email !== undefined) {
      setClauses.push(`email = $${paramIndex++}`);
      params.push(updates.email);
    }
    if (updates.password !== undefined) {
      setClauses.push(`password = $${paramIndex++}`);
      params.push(updates.password);
    }
    if (updates.userRole !== undefined) {
      setClauses.push(`user_role = $${paramIndex++}`);
      params.push(updates.userRole);
    }
    if (updates.accessToken !== undefined) {
      setClauses.push(`access_token = $${paramIndex++}`);
      params.push(updates.accessToken);
    }

    if (setClauses.length === 0) {
      return existingUser;
    }

    params.push(id);

    const sql = `
      UPDATE users
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, username, email, password, user_role as "userRole", access_token as "accessToken", created_at as "createdAt", updated_at as "updatedAt"
    `;

    return await this._postgresService.queryOne<User>(sql, params);
  }

  public async delete(id: string): Promise<boolean> {
    const sql = 'DELETE FROM users WHERE id = $1';
    const rowCount = await this._postgresService.execute(sql, [id]);
    return rowCount > 0;
  }

  public async findAll(): Promise<User[]> {
    const sql = `
      SELECT id, username, email, password, user_role as "userRole", access_token as "accessToken", created_at as "createdAt", updated_at as "updatedAt"
      FROM users
      ORDER BY created_at DESC
    `;
    return await this._postgresService.query<User>(sql);
  }

  public async findByRole(userRole: UserRole): Promise<User[]> {
    const sql = `
      SELECT id, username, email, password, user_role as "userRole", access_token as "accessToken", created_at as "createdAt", updated_at as "updatedAt"
      FROM users
      WHERE user_role = $1
      ORDER BY created_at DESC
    `;
    return await this._postgresService.query<User>(sql, [userRole]);
  }
}