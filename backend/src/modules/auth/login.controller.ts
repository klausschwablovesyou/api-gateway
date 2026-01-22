import { Controller, Post, Body, HttpException, HTTP_STATUS } from '@danet/core';
import { AuthService } from './auth.service.ts';
import { ConfigManagerService } from '../config-manager/config-manager.service.ts';
import type { AuthRequestDto } from '@shared/dtos/auth-request.dto.ts';
import type { AuthResponseDto } from '@shared/dtos/auth-response.dto.ts';
import type { RegisterRequestDto } from '@shared/dtos/register-request.dto.ts';

@Controller('auth')
export class LoginController {
  public constructor(
    private authService: AuthService,
    private configManagerService: ConfigManagerService
  ) {}

  @Post('login')
  async login(@Body() loginDto: AuthRequestDto): Promise<AuthResponseDto> {
    const result = await this.authService.login(loginDto.username, loginDto.password);

    return {
      success: true,
      token: result.token,
      user: result.user,
    };
  }

  @Post('register')
  async register(@Body() registerDto: RegisterRequestDto): Promise<AuthResponseDto> {
    const isRegistrationEnabled = await this.configManagerService.isRegistrationEnabled();
    if (!isRegistrationEnabled) {
      throw new HttpException('Registration is disabled', HTTP_STATUS.FORBIDDEN);
    }

    const result = await this.authService.register(registerDto.username, registerDto.email, registerDto.password);

    return {
      success: true,
      token: result.token,
      user: result.user,
    };
  }
}