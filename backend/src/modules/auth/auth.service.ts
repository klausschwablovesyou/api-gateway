import { Injectable } from '@danet/core';
import { UserRepository } from '@backend/shared/repositories/user.repository.ts';
import { JwtService } from '@backend/shared/services/jwt.service.ts';
import { PasswordService } from '@backend/shared/services/password.service.ts';
import { AuthResult } from '@backend/dtos/auth-result.dto.ts';
import { User } from "@shared/models/user.model.ts";
import {
  HttpError
} from "https://raw.githubusercontent.com/mandarineorg/mandarinets-modules/master/oak/6.4.1/httpError.ts";
import { Status } from "https://deno.land/std@0.82.0/http/http_status.ts";

@Injectable()
export class AuthService {
  public constructor(
    private userRepository: UserRepository,
    private jwtService: JwtService,
    private passwordService: PasswordService
  ) {}

  public async login(username: string, password: string): Promise<AuthResult> {
    const user = await this.userRepository.findByUsername(username);

    if (!user) {
      const error = new HttpError('Auth.Error.InvalidCredentials');
      error.status = Status.Unauthorized;
      throw error;
    }

    const isPasswordValid = await this.passwordService.verifyPassword(password, user.password);

    if (!isPasswordValid) {
      const error = new HttpError('Auth.Error.InvalidCredentials');
      error.status = Status.Unauthorized;
      throw error;
    }

    const token = await this.jwtService.generateToken(user.id, user.userRole, user.email);
    user.password = '';
    user.email = '';

    return {
      token,
      user: new User(user),
    };
  }

  public async register(username: string, email: string, password: string): Promise<AuthResult> {
    // Validate password strength
    const passwordValidation = this.passwordService.validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      const error = new HttpError(passwordValidation.errors.join(', '));
      error.status = Status.BadRequest;
      throw error;
    }

    const existingUserByUsername = await this.userRepository.findByUsername(username);
    if (existingUserByUsername) {
      const error = new HttpError('Auth.Error.UsernameExists');
      error.status = Status.Conflict;
      throw error;
    }

    const existingUserByEmail = await this.userRepository.findByEmail(email);
    if (existingUserByEmail) {
      const error = new HttpError('Auth.Error.EmailExists');
      error.status = Status.Conflict;
      throw error;
    }

    // Hash the password before storing
    const hashedPassword = await this.passwordService.hashPassword(password);

    const user = await this.userRepository.create({
      username,
      email,
      password: hashedPassword,
    });

    const token = await this.jwtService.generateToken(user.id, user.userRole, user.email);
    user.password = '';

    return {
      token,
      user: new User(user),
    };
  }

}