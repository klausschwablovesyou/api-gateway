import { Inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { HttpResponse } from '@angular/common/http';
import { API_CLIENT_SERVICE_IMPL, IApiClientService } from '@app/modules/api/api-client/i-api-client.service';
import { GetRequestData } from '@app/modules/api/types/get-request-data';
import { RequestLog } from '@shared/models/request-log.model';

@Injectable({
  providedIn: 'root'
})
export class RequestLogManagerService {
  public constructor(
    @Inject(API_CLIENT_SERVICE_IMPL) private readonly _apiClient: IApiClientService
  ) {}

  public getAll(limit = 100, offset = 0): Observable<RequestLog[]> {
    const requestData = new GetRequestData({
      endpoint: `request-log?limit=${limit}&offset=${offset}`
    });
    return this._apiClient.get<RequestLog[]>(requestData).pipe(
      map((response: HttpResponse<RequestLog[]>) => response.body || [])
    );
  }
}
