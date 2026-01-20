import { Controller, Get, Post, Put, Delete, Body, Param, HttpException, HTTP_STATUS } from '@danet/core';
import { ApiManagerService } from './api-manager.service.ts';
import { Api } from '@shared/models/api.model.ts';
import type { UpdateApiDto } from '@shared/dtos/update-api.dto.ts';
import type { CreateApiDto } from "@shared/dtos/create-api.dto.ts";

@Controller('api-manager')
export class ApiManagerController {
  public constructor(
    private readonly _apiManagerService: ApiManagerService
  ) {}

  @Post()
  async create(@Body() dto: CreateApiDto): Promise<Api> {
    return await this._apiManagerService.create(dto);
  }

  @Get()
  async findAll(): Promise<Api[]> {
    return await this._apiManagerService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<Api> {
    const api = await this._apiManagerService.findById(id);
    if (!api) {
      throw new HttpException('API not found', HTTP_STATUS.NOT_FOUND);
    }
    return api;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateApiDto): Promise<Api> {
    const api = await this._apiManagerService.update(id, dto);
    if (!api) {
      throw new HttpException('API not found', HTTP_STATUS.NOT_FOUND);
    }
    return api;
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<{ success: boolean }> {
    const result = await this._apiManagerService.delete(id);
    return { success: result };
  }

  @Post(':id/regenerate-keys')
  async regenerateKeys(@Param('id') id: string): Promise<Api> {
    return await this._apiManagerService.regenerateKeys(id);
  }
}
