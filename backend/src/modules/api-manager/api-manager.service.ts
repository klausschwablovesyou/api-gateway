import { Injectable, HttpException, HTTP_STATUS } from '@danet/core';
import { ApiRepository } from '../../shared/repositories/api.repository.ts';
import { ApiKeyService } from '../../shared/services/api-key.service.ts';
import { Api } from '@shared/models/api.model.ts';
import { CreateApiDto } from '@shared/dtos/create-api.dto.ts';
import { UpdateApiDto } from '@shared/dtos/update-api.dto.ts';

@Injectable()
export class ApiManagerService {
  public constructor(
    private readonly _apiRepository: ApiRepository,
    private readonly _apiKeyService: ApiKeyService
  ) {}

  public async create(dto: CreateApiDto): Promise<Api> {
    const existing = await this._apiRepository.findByName(dto.name);
    if (existing) {
      throw new HttpException(HTTP_STATUS.CONFLICT, 'API with this name already exists');
    }

    const keyPair = this._apiKeyService.generateKeyPair();

    return await this._apiRepository.create({
      name: dto.name,
      apiUrl: dto.apiUrl,
      method: dto.method,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      requestLimit: dto.requestLimit,
      requestLimitUnit: dto.requestLimitUnit,
    });
  }

  public async findAll(): Promise<Api[]> {
    return await this._apiRepository.findAll();
  }

  public async findById(id: string): Promise<Api | null> {
    return await this._apiRepository.findById(id);
  }

  public async update(id: string, dto: UpdateApiDto): Promise<Api | null> {
    const existing = await this._apiRepository.findById(id);
    if (!existing) {
      throw new HttpException(HTTP_STATUS.NOT_FOUND, 'API not found');
    }

    if (dto.name && dto.name !== existing.name) {
      const nameExists = await this._apiRepository.findByName(dto.name);
      if (nameExists) {
        throw new HttpException(HTTP_STATUS.CONFLICT, 'API with this name already exists');
      }
    }

    return await this._apiRepository.update(id, dto);
  }

  public async delete(id: string): Promise<boolean> {
    const existing = await this._apiRepository.findById(id);
    if (!existing) {
      throw new HttpException(HTTP_STATUS.NOT_FOUND, 'API not found');
    }

    return await this._apiRepository.delete(id);
  }

  public async regenerateKeys(id: string): Promise<Api> {
    const existing = await this._apiRepository.findById(id);
    if (!existing) {
      throw new HttpException(HTTP_STATUS.NOT_FOUND, 'API not found');
    }

    const keyPair = this._apiKeyService.generateKeyPair();

    await this._apiRepository.delete(id);
    return await this._apiRepository.create({
      name: existing.name,
      apiUrl: existing.apiUrl,
      method: existing.method,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      requestLimit: existing.requestLimit,
      requestLimitUnit: existing.requestLimitUnit,
    });
  }
}
