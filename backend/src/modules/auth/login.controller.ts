import { Controller, Post, Body, HttpException, HTTP_STATUS } from '@danet/core';
import { AuthService } from './auth.service.ts';
import type { AuthRequestDto } from '@shared/dtos/auth-request.dto.ts';
import type { AuthResponseDto } from '@shared/dtos/auth-response.dto.ts';
import type { RegisterRequestDto } from '@shared/dtos/register-request.dto.ts';

@Controller('auth')
export class LoginController {
  public constructor(
    private authService: AuthService
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
    const result = await this.authService.register(registerDto.username, registerDto.email, registerDto.password);
    
    return {
      success: true,
      token: result.token,
      user: result.user,
    };
  }
}