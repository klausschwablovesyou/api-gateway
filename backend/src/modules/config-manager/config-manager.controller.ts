import { Controller, Get, Put, Body } from '@danet/core';
import { ConfigManagerService } from './config-manager.service.ts';
import { Roles } from '../../shared/decorators/roles.decorator.ts';
import { UserRole } from '@shared/types/user-role.ts';
import type { ConfigResponseDto } from '@shared/dtos/config-response.dto.ts';
import type { UpdateConfigDto } from '@shared/dtos/update-config.dto.ts';

@Controller('config')
export class ConfigManagerController {
  public constructor(
    private readonly _configManagerService: ConfigManagerService
  ) {}

  @Get()
  async getPublicConfig(): Promise<ConfigResponseDto> {
    return await this._configManagerService.getConfig();
  }

  @Put()
  @Roles(UserRole.SuperAdmin)
  async updateConfig(@Body() dto: UpdateConfigDto): Promise<ConfigResponseDto> {
    return await this._configManagerService.updateConfig(dto);
  }
}
