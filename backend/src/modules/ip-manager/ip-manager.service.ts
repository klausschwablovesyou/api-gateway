import { Injectable, HttpException, HTTP_STATUS } from '@danet/core';
import { IpRepository } from '../../shared/repositories/ip.repository.ts';
import { IpSyncService } from '../../shared/services/ip-sync.service.ts';
import { Ip } from '@shared/models/ip.model.ts';
import { CreateIpDto } from '@shared/dtos/create-ip.dto.ts';
import { UpdateIpDto } from '@shared/dtos/update-ip.dto.ts';

@Injectable()
export class IpManagerService {
  public constructor(
    private readonly _ipRepository: IpRepository,
    private readonly _ipSyncService: IpSyncService
  ) {}

  public async create(dto: CreateIpDto): Promise<Ip> {
    const existing = await this._ipRepository.findByIp(dto.ip);
    if (existing) {
      throw new HttpException('IP already exists', HTTP_STATUS.CONFLICT);
    }

    // First, try to add IP to network interface
    await this._ipSyncService.addIpToNetwork(dto.ip);

    // Verify the IP can make outbound requests
    const verification = await this._ipSyncService.verifyIpWorks(dto.ip);
    if (!verification.success) {
      // Rollback: remove IP from network
      await this._ipSyncService.removeIpFromNetwork(dto.ip);
      throw new HttpException(
        `IP verification failed: ${verification.error}`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // IP works, save to database
    const ip = await this._ipRepository.create({
      ip: dto.ip,
    });

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
      throw new HttpException('IP not found', HTTP_STATUS.NOT_FOUND);
    }

    if (dto.ip && dto.ip !== existing.ip) {
      const ipExists = await this._ipRepository.findByIp(dto.ip);
      if (ipExists) {
        throw new HttpException('IP already exists', HTTP_STATUS.CONFLICT);
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
      throw new HttpException('IP not found', HTTP_STATUS.NOT_FOUND);
    }

    await this._ipSyncService.removeIpFromNetwork(existing.ip);

    return await this._ipRepository.delete(id);
  }
}
