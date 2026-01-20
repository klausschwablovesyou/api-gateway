import { Controller, Get, Post, Put, Delete, Body, Param, HttpException, HTTP_STATUS } from '@danet/core';
import { IpManagerService } from './ip-manager.service.ts';
import { Ip } from '@shared/models/ip.model.ts';
import { Roles } from '../../shared/decorators/roles.decorator.ts';
import { UserRole } from '@shared/types/user-role.ts';
import type { CreateIpDto } from '@shared/dtos/create-ip.dto.ts';
import type { UpdateIpDto } from '@shared/dtos/update-ip.dto.ts';

@Controller('ip-manager')
export class IpManagerController {
  public constructor(
    private readonly _ipManagerService: IpManagerService
  ) {}

  @Post()
  @Roles(UserRole.SuperAdmin)
  async create(@Body() dto: CreateIpDto): Promise<Ip> {
    return await this._ipManagerService.create(dto);
  }

  @Get()
  @Roles(UserRole.SuperAdmin)
  async findAll(): Promise<Ip[]> {
    return await this._ipManagerService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.SuperAdmin)
  async findById(@Param('id') id: string): Promise<Ip> {
    const ip = await this._ipManagerService.findById(id);
    if (!ip) {
      throw new HttpException('IP not found', HTTP_STATUS.NOT_FOUND);
    }
    return ip;
  }

  @Put(':id')
  @Roles(UserRole.SuperAdmin)
  async update(@Param('id') id: string, @Body() dto: UpdateIpDto): Promise<Ip> {
    const ip = await this._ipManagerService.update(id, dto);
    if (!ip) {
      throw new HttpException('IP not found', HTTP_STATUS.NOT_FOUND);
    }
    return ip;
  }

  @Delete(':id')
  @Roles(UserRole.SuperAdmin)
  async delete(@Param('id') id: string): Promise<{ success: boolean }> {
    const result = await this._ipManagerService.delete(id);
    return { success: result };
  }
}
