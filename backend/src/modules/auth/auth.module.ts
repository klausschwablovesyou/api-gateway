import { Module } from '@danet/core';
import { LoginController } from './login.controller.ts';
import { AuthService } from './auth.service.ts';
import { PostgresService } from '../../shared/database/postgres.service.ts';
import { UserRepository } from '../../shared/repositories/user.repository.ts';
import { JwtService } from '../../shared/services/jwt.service.ts';
import { PasswordService } from '../../shared/services/password.service.ts';

@Module({
  controllers: [LoginController],
  injectables: [AuthService, PostgresService, UserRepository, JwtService, PasswordService],
})
export class AuthModule {}