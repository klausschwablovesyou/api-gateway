import { Injectable, HttpException, HTTP_STATUS } from '@danet/core';
import { IpRepository } from '../../shared/repositories/ip.repository.ts';
import { IpSyncService } from '../../shared/services/ip-sync.service.ts';
import { Ip } from '@shared/models/ip.model.ts';
import { CreateIpDto } from '@shared/dtos/create-ip.dto.ts';
import { UpdateIpDto } from '@shared/dtos/update-ip.dto.ts';
import { IpSyncResponseDto } from '@shared/dtos/ip-sync-response.dto.ts';

@Injectable()
export class IpManagerService {
  public constructor(
    private readonly _ipRepository: IpRepository,
    private readonly _ipSyncService: IpSyncService
  ) {}

  public async create(dto: CreateIpDto): Promise<Ip> {
    const existing = await this._ipRepository.findByIp(dto.ip);
    if (existing) {
      throw new HttpException(HTTP_STATUS.CONFLICT, 'IP already exists');
    }

    const ip = await this._ipRepository.create({
      ip: dto.ip,
    });

    await this._ipSyncService.addIpToNetwork(ip.ip);

    return ip;
  }

  public async findAll(): Promise<Ip[]> {
    return await this._ipRepository.findAll();
  }

  public async findById(id: string): Promise<Ip | null> {
    return await this._ipRepository.findById(id);
  }

  public async update(id: string, dto: UpdateIpDto): Promise<Ip | null> {
    const existing = await this._ipRepository.findById(id);
    if (!existing) {
      throw new HttpException(HTTP_STATUS.NOT_FOUND, 'IP not found');
    }

    if (dto.ip && dto.ip !== existing.ip) {
      const ipExists = await this._ipRepository.findByIp(dto.ip);
      if (ipExists) {
        throw new HttpException(HTTP_STATUS.CONFLICT, 'IP already exists');
      }

      // Remove old IP and add new one
      await this._ipSyncService.removeIpFromNetwork(existing.ip);
      await this._ipSyncService.addIpToNetwork(dto.ip);
    }

    return await this._ipRepository.update(id, dto);
  }

  public async delete(id: string): Promise<boolean> {
    const existing = await this._ipRepository.findById(id);
    if (!existing) {
      throw new HttpException(HTTP_STATUS.NOT_FOUND, 'IP not found');
    }

    await this._ipSyncService.removeIpFromNetwork(existing.ip);

    return await this._ipRepository.delete(id);
  }

  public async syncAll(): Promise<IpSyncResponseDto> {
    return await this._ipSyncService.syncIpsToNetwork();
  }
}
