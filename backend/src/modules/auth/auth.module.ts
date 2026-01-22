import { Module } from '@danet/core';
import { LoginController } from './login.controller.ts';
import { AuthService } from './auth.service.ts';
import { PostgresService } from '../../shared/database/postgres.service.ts';
import { UserRepository } from '../../shared/repositories/user.repository.ts';
import { JwtService } from '../../shared/services/jwt.service.ts';
import { PasswordService } from '../../shared/services/password.service.ts';
import { ConfigManagerService } from '../config-manager/config-manager.service.ts';
import { ConfigRepository } from '../../shared/repositories/config.repository.ts';

@Module({
  controllers: [LoginController],
  injectables: [AuthService, PostgresService, UserRepository, JwtService, PasswordService, ConfigManagerService, ConfigRepository],
})
export class AuthModule {}