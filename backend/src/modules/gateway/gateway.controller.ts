import { Controller, Get, Query, HttpException, HTTP_STATUS, Header } from '@danet/core';
import { GatewayService } from './gateway.service.ts';

@Controller('gateway')
export class GatewayController {
  public constructor(
    private gatewayService: GatewayService
  ) {}

  @Get()
  async get(
    @Header('x-api-public-key') publicKey: string,
    @Header('x-api-signature') signature: string,
    @Query('apiName') apiName: string,
    @Query() params: Record<string, string>
  ): Promise<unknown> {
    if (!apiName) {
      throw new HttpException('apiName parameter is required', HTTP_STATUS.BAD_REQUEST);
    }

    if (!publicKey) {
      throw new HttpException('x-api-public-key header is required', HTTP_STATUS.BAD_REQUEST);
    }

    if (!signature) {
      throw new HttpException('x-api-signature header is required', HTTP_STATUS.BAD_REQUEST);
    }

    const { apiName: _, ...optionalParams } = params;
    return await this.gatewayService.forwardRequest(apiName, publicKey, signature, optionalParams);
  }
}
