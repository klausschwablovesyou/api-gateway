import { Injectable } from '@danet/core';
import { ConfigRepository } from '../../shared/repositories/config.repository.ts';
import type { ConfigResponseDto } from '@shared/dtos/config-response.dto.ts';
import type { UpdateConfigDto } from '@shared/dtos/update-config.dto.ts';

@Injectable()
export class ConfigManagerService {
  public constructor(private readonly _configRepository: ConfigRepository) {}

  public async getConfig(): Promise<ConfigResponseDto> {
    const enableRegistrationConfig = await this._configRepository.get('enableRegistration');

    return {
      enableRegistration: enableRegistrationConfig?.value === 'true',
    };
  }

  public async updateConfig(dto: UpdateConfigDto): Promise<ConfigResponseDto> {
    if (dto.enableRegistration !== undefined) {
      await this._configRepository.set('enableRegistration', dto.enableRegistration.toString());
    }

    return this.getConfig();
  }

  public async isRegistrationEnabled(): Promise<boolean> {
    const config = await this._configRepository.get('enableRegistration');
    return config?.value === 'true';
  }
}
