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
    console.log('[GatewayController] Incoming request');
    console.log('[GatewayController] apiName:', apiName);
    console.log('[GatewayController] publicKey:', publicKey);
    console.log('[GatewayController] signature:', signature);
    console.log('[GatewayController] params:', params);

    if (!apiName) {
      console.warn('[GatewayController] Missing apiName');
      throw new HttpException('apiName parameter is required', HTTP_STATUS.BAD_REQUEST);
    }

    if (!publicKey) {
      console.warn('[GatewayController] Missing x-api-public-key header');
      throw new HttpException('x-api-public-key header is required', HTTP_STATUS.BAD_REQUEST);
    }

    if (!signature) {
      console.warn('[GatewayController] Missing x-api-signature header');
      throw new HttpException('x-api-signature header is required', HTTP_STATUS.BAD_REQUEST);
    }

    const { apiName: _, ...optionalParams } = params;
    console.log('[GatewayController] optionalParams after stripping apiName:', optionalParams);

    const result = await this.gatewayService.forwardRequest(apiName, publicKey, signature, optionalParams);
    console.log('[GatewayController] Request completed successfully');
    return result;
  }
}
