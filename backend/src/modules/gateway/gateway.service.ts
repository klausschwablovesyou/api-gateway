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
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

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
    const api = await this._apiRepository.findByName(apiName);

    if (!api) {
      throw new HttpException('API not found', HTTP_STATUS.NOT_FOUND);
    }

    if (api.publicKey !== publicKey) {
      throw new HttpException('Invalid API key', HTTP_STATUS.UNAUTHORIZED);
    }

    const isValidSignature = await this._apiKeyService.validateSignature(
      apiName,
      signature,
      api.privateKey
    );

    if (!isValidSignature) {
      throw new HttpException('Invalid signature', HTTP_STATUS.UNAUTHORIZED);
    }

    // Get available IP for this API
    const availableIp = await this._getAvailableIp(api);

    if (!availableIp) {
      throw new HttpException('Too many requests. No available IPs.', HTTP_STATUS.TOO_MANY_REQUESTS);
    }

    // Build request URL
    const url = new URL(api.apiUrl);

    if (api.method === HttpMethod.GET || api.method === HttpMethod.DELETE) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, value);
      }
    }

    // Make request with local IP binding
    const result = await this._makeRequestWithLocalIp(
      url,
      api.method,
      availableIp.ip,
      api.method === HttpMethod.GET || api.method === HttpMethod.DELETE ? undefined : params
    );

    // Update IP usage
    await this._updateIpUsage(availableIp, api);

    console.log(`[Gateway] ${api.method} ${apiName} -> (IP: ${availableIp.ip}) -> ${url.toString()}`);

    return result;
  }

  private async _getAvailableIp(api: Api): Promise<Ip | null> {
    const allIps = await this._ipRepository.findAll();

    if (allIps.length === 0) {
      return null;
    }

    const now = Date.now();
    const periodStart = this._getPeriodStart(now, api.requestLimitUnit);
    const availableIps: Ip[] = [];

    for (const ip of allIps) {
      const usage = await this._ipUsageRepository.findByIpAndApi(ip.id, api.id);

      if (!usage) {
        // Never used for this API - available
        availableIps.push(ip);
        continue;
      }

      const usagePeriodStart = this._getPeriodStart(Number(usage.lastUsedAt), api.requestLimitUnit);

      if (usagePeriodStart < periodStart) {
        // Last used in a previous period - available (counter will be reset)
        availableIps.push(ip);
        continue;
      }

      if (usagePeriodStart === periodStart && Number(usage.requestLimitCounter) < api.requestLimit) {
        // Same period but under the limit - available
        availableIps.push(ip);
        continue;
      }
    }

    if (availableIps.length === 0) {
      return null;
    }

    // Randomly pick one
    const randomIndex = Math.floor(Math.random() * availableIps.length);
    return availableIps[randomIndex];
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
      // Create new usage record
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
      // New period - reset counter
      await this._ipUsageRepository.upsert(ip.id, api.id, now, 1);
    } else {
      // Same period - increment counter
      await this._ipUsageRepository.upsert(ip.id, api.id, now, Number(usage.requestLimitCounter) + 1);
    }
  }

  private async _makeRequestWithLocalIp(
    url: URL,
    method: HttpMethod,
    localAddress: string,
    body?: Record<string, string>
  ): Promise<unknown> {
    const isHttps = url.protocol === 'https:';
    const requestFn = isHttps ? httpsRequest : httpRequest;

    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: method,
        localAddress: localAddress,
        headers: {} as Record<string, string>,
      };

      if (body) {
        options.headers['Content-Type'] = 'application/json';
      }

      const req = requestFn(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          const contentType = res.headers['content-type'] || '';

          if (!res.statusCode || res.statusCode >= 400) {
            reject(new HttpException(
              `Target API returned ${res.statusCode}: ${res.statusMessage}`,
              res.statusCode || 500
            ));
            return;
          }

          if (contentType.includes('application/json')) {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve({ data });
            }
          } else {
            resolve({ data });
          }
        });
      });

      req.on('error', (err) => {
        reject(new HttpException(`Request failed: ${err.message}`, 500));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }
}
