import { Controller, Get, Query } from '@danet/core';
import { Roles } from '../../shared/decorators/roles.decorator.ts';
import { UserRole } from '@shared/types/user-role.ts';
import { RequestLogRepository } from '../../shared/repositories/request-log.repository.ts';
import { RequestLog } from '@shared/models/request-log.model.ts';

@Controller('request-log')
export class RequestLogController {
  public constructor(
    private readonly _requestLogRepository: RequestLogRepository
  ) {}

  @Get()
  @Roles(UserRole.SuperAdmin)
  public async findAll(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ): Promise<RequestLog[]> {
    return await this._requestLogRepository.findAll(
      limit ? parseInt(limit, 10) : 100,
      offset ? parseInt(offset, 10) : 0
    );
  }
}
