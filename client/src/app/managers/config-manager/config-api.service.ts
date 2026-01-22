import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpResponse } from '@angular/common/http';
import { API_CLIENT_SERVICE_IMPL, IApiClientService } from '@app/modules/api/api-client/i-api-client.service';
import { GetRequestData } from '@app/modules/api/types/get-request-data';
import { PutRequestData } from '@app/modules/api/types/put-request-data';
import { ConfigResponseDto } from '@shared/dtos/config-response.dto';
import { UpdateConfigDto } from '@shared/dtos/update-config.dto';

@Injectable({
  providedIn: 'root'
})
export class ConfigApiService {
  constructor(
    @Inject(API_CLIENT_SERVICE_IMPL) private readonly _apiClient: IApiClientService
  ) {}

  public getConfig(): Observable<HttpResponse<ConfigResponseDto>> {
    const requestData = new GetRequestData({
      endpoint: 'config'
    });
    return this._apiClient.get<ConfigResponseDto>(requestData);
  }

  public updateConfig(dto: UpdateConfigDto): Observable<HttpResponse<ConfigResponseDto>> {
    const requestData = new PutRequestData({
      endpoint: 'config',
      requestBody: dto,
      responseMessages: [
        { statusCode: 200, messageText: 'ConfigManager.Messages.UpdateSuccess', status: 'success' }
      ]
    });
    return this._apiClient.put<ConfigResponseDto>(requestData);
  }
}
