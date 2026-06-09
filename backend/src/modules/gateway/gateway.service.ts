import { Injectable, HttpException, HTTP_STATUS } from '@danet/core';
import { ApiRepository } from '../../shared/repositories/api.repository.ts';
import { IpRepository } from '../../shared/repositories/ip.repository.ts';
import { IpUsageRepository } from '../../shared/repositories/ip-usage.repository.ts';
import { ApiKeyService } from '../../shared/services/api-key.service.ts';
import { HttpMethod } from '@shared/types/http-method.ts';
import { RequestLimitUnit } from '@shared/types/request-limit-unit.ts';
import { Api } from '@shared/models/api.model.ts';
import { Ip } from '@shared/models/ip.model.ts';
import { IpUsage } from '@shared/models/ip-usage.model.ts';

interface IpWithUsage extends Ip {
  usage: IpUsage | null;
}

@Injectable()
export class GatewayService {
  public constructor(
    private readonly _apiRepository: ApiRepository,
    private readonly _ipRepository: IpRepository,
    private readonly _ipUsageRepository: IpUsageRepository,
    private readonly _apiKeyService: ApiKeyService
  ) {}

  async forwardRequest(
    apiName: string,
    publicKey: string,
    signature: string,
    params: Record<string, string>
  ): Promise<unknown> {
    console.log('[GatewayService] forwardRequest called for:', apiName);

    const api = await this._apiRepository.findByName(apiName);
    console.log('[GatewayService] API lookup result:', api ? `found (id: ${api.id})` : 'NOT FOUND');

    if (!api) {
      throw new HttpException('API not found', HTTP_STATUS.NOT_FOUND);
    }

    console.log('[GatewayService] Checking public key...');
    console.log('[GatewayService] Expected:', api.publicKey);
    console.log('[GatewayService] Received:', publicKey);

    if (api.publicKey !== publicKey) {
      console.warn('[GatewayService] Public key mismatch');
      throw new HttpException('Invalid API key', HTTP_STATUS.UNAUTHORIZED);
    }

    console.log('[GatewayService] Validating signature...');
    const isValidSignature = await this._apiKeyService.validateSignature(
      apiName,
      signature,
      api.privateKey
    );
    console.log('[GatewayService] Signature valid:', isValidSignature);

    if (!isValidSignature) {
      console.warn('[GatewayService] Invalid signature');
      throw new HttpException('Invalid signature', HTTP_STATUS.UNAUTHORIZED);
    }

    console.log('[GatewayService] Getting available IP...');
    const availableIp = await this._getAvailableIp(api);
    console.log('[GatewayService] Available IP:', availableIp ? availableIp.ip : 'NONE');

    if (!availableIp) {
      throw new HttpException('Too many requests. No available IPs.', HTTP_STATUS.TOO_MANY_REQUESTS);
    }

    console.log('[GatewayService] Building URL from:', api.apiUrl, 'with params:', params);
    const { url: urlString, remainingParams } = this._buildUrlWithPlaceholders(api.apiUrl, params);
    console.log('[GatewayService] Built URL:', urlString);
    console.log('[GatewayService] Remaining params:', remainingParams);

    const url = new URL(urlString);

    if (api.method === HttpMethod.GET || api.method === HttpMethod.DELETE) {
      for (const [key, value] of Object.entries(remainingParams)) {
        url.searchParams.append(key, value);
      }
    }

    console.log('[GatewayService] Final URL:', url.toString());
    console.log('[GatewayService] Making request with local IP:', availableIp.ip);

    const result = await this._makeRequestWithLocalIp(
      url,
      api.method,
      availableIp.ip,
      api.method === HttpMethod.GET || api.method === HttpMethod.DELETE ? undefined : remainingParams
    );

    console.log('[GatewayService] Request succeeded, updating IP usage...');
    await this._updateIpUsage(availableIp, api);

    console.log(`[Gateway] ${api.method} ${apiName} -> (IP: ${availableIp.ip}) -> ${url.toString()}`);

    return result;
  }

  private async _getAvailableIp(api: Api): Promise<Ip | null> {
    const allIps = await this._ipRepository.findAll();
    console.log('[GatewayService] Total IPs in DB:', allIps.length);

    if (allIps.length === 0) {
      return null;
    }

    const now = Date.now();
    const periodStart = this._getPeriodStart(now, api.requestLimitUnit);
    const availableIps: Ip[] = [];

    for (const ip of allIps) {
      const usage = await this._ipUsageRepository.findByIpAndApi(ip.id, api.id);

      if (!usage) {
        availableIps.push(ip);
        continue;
      }

      const usagePeriodStart = this._getPeriodStart(Number(usage.lastUsedAt), api.requestLimitUnit);

      if (usagePeriodStart < periodStart) {
        availableIps.push(ip);
        continue;
      }

      if (usagePeriodStart === periodStart && Number(usage.requestLimitCounter) < api.requestLimit) {
        availableIps.push(ip);
        continue;
      }

      console.log(`[GatewayService] IP ${ip.ip} exhausted for this period (counter: ${usage.requestLimitCounter}/${api.requestLimit})`);
    }

    console.log('[GatewayService] Available IPs:', availableIps.length);

    if (availableIps.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * availableIps.length);
    return availableIps[randomIndex];
  }

  private _buildUrlWithPlaceholders(
    apiUrl: string,
    params: Record<string, string>
  ): { url: string; remainingParams: Record<string, string> } {
    const remainingParams = { ...params };
    let url = apiUrl;

    const placeholderRegex = /\{(\w+)\}/g;
    let match;

    while ((match = placeholderRegex.exec(apiUrl)) !== null) {
      const placeholder = match[0];
      const paramName = match[1];

      if (paramName in remainingParams) {
        url = url.replace(placeholder, encodeURIComponent(remainingParams[paramName]));
        delete remainingParams[paramName];
      }
    }

    return { url, remainingParams };
  }

  private _getPeriodStart(timestamp: number, unit: RequestLimitUnit): number {
    const date = new Date(timestamp);

    switch (unit) {
      case RequestLimitUnit.Second:
        date.setMilliseconds(0);
        break;
      case RequestLimitUnit.Minute:
        date.setSeconds(0, 0);
        break;
      case RequestLimitUnit.Hour:
        date.setMinutes(0, 0, 0);
        break;
      case RequestLimitUnit.Day:
        date.setHours(0, 0, 0, 0);
        break;
    }

    return date.getTime();
  }

  private async _updateIpUsage(ip: Ip, api: Api): Promise<void> {
    const now = Date.now();
    const periodStart = this._getPeriodStart(now, api.requestLimitUnit);
    const usage = await this._ipUsageRepository.findByIpAndApi(ip.id, api.id);

    if (!usage) {
      await this._ipUsageRepository.create({
        ipId: ip.id,
        apiId: api.id,
        lastUsedAt: now,
        requestLimitCounter: 1,
      });
      return;
    }

    const usagePeriodStart = this._getPeriodStart(Number(usage.lastUsedAt), api.requestLimitUnit);

    if (usagePeriodStart < periodStart) {
      await this._ipUsageRepository.upsert(ip.id, api.id, now, 1);
    } else {
      await this._ipUsageRepository.upsert(ip.id, api.id, now, Number(usage.requestLimitCounter) + 1);
    }
  }

  private async _makeRequestWithLocalIp(
    url: URL,
    method: HttpMethod,
    localAddress: string,
    body?: Record<string, string>
  ): Promise<unknown> {
    console.log('[GatewayService] _makeRequestWithLocalIp:', method, url.toString(), 'via', localAddress);

    const client = Deno.createHttpClient({
      localAddress: localAddress,
    });

    try {
      const fetchOptions: RequestInit & { client: Deno.HttpClient } = {
        method: method,
        client: client,
      };

      if (body) {
        fetchOptions.headers = { 'Content-Type': 'application/json' };
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url.toString(), fetchOptions);
      console.log('[GatewayService] Response status:', response.status, response.statusText);

      if (!response.ok) {
        throw new HttpException(
          `Target API returned ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      const contentType = response.headers.get('content-type') || '';
      const data = await response.text();
      console.log('[GatewayService] Response body:', data);

      if (contentType.includes('application/json')) {
        try {
          return JSON.parse(data);
        } catch {
          return { data };
        }
      } else {
        return { data };
      }
    } catch (err) {
      console.error('[GatewayService] Request error:', err);
      if (err instanceof HttpException) {
        throw err;
      }
      throw new HttpException(`Request failed: ${String(err)}`, 500);
    } finally {
      client.close();
    }
  }
}
