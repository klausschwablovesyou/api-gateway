import { Inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { HttpResponse } from '@angular/common/http';
import { API_CLIENT_SERVICE_IMPL, IApiClientService } from '@app/modules/api/api-client/i-api-client.service';
import { GetRequestData } from '@app/modules/api/types/get-request-data';
import { PostRequestData } from '@app/modules/api/types/post-request-data';
import { PutRequestData } from '@app/modules/api/types/put-request-data';
import { DeleteRequestData } from '@app/modules/api/types/delete-request-data';
import { Api } from '@shared/models/api.model';
import { CreateApiDto } from '@shared/dtos/create-api.dto';
import { UpdateApiDto } from '@shared/dtos/update-api.dto';
import { SuccessResponseDto } from '@shared/dtos/success-response.dto';

@Injectable({
  providedIn: 'root'
})
export class ApiManagerService {
  constructor(
    @Inject(API_CLIENT_SERVICE_IMPL) private readonly _apiClient: IApiClientService
  ) {}

  public getAll(): Observable<Api[]> {
    const requestData = new GetRequestData({
      endpoint: 'api-manager'
    });
    return this._apiClient.get<Api[]>(requestData).pipe(
      map((response: HttpResponse<Api[]>) => response.body || [])
    );
  }

  public getById(id: string): Observable<Api> {
    const requestData = new GetRequestData({
      endpoint: `api-manager/${id}`
    });
    return this._apiClient.get<Api>(requestData).pipe(
      map((response: HttpResponse<Api>) => response.body!)
    );
  }

  public create(dto: CreateApiDto): Observable<Api> {
    const requestData = new PostRequestData({
      endpoint: 'api-manager',
      requestBody: dto,
      responseMessages: [
        { statusCode: 201, messageText: 'ApiManager.Messages.CreateSuccess', status: 'success' },
        { statusCode: 409, messageText: 'ApiManager.Messages.AlreadyExists', status: 'danger' }
      ]
    });
    return this._apiClient.post<Api>(requestData).pipe(
      map((response: HttpResponse<Api>) => response.body!)
    );
  }

  public update(id: string, dto: UpdateApiDto): Observable<Api> {
    const requestData = new PutRequestData({
      endpoint: `api-manager/${id}`,
      requestBody: dto,
      responseMessages: [
        { statusCode: 200, messageText: 'ApiManager.Messages.UpdateSuccess', status: 'success' },
        { statusCode: 404, messageText: 'ApiManager.Messages.NotFound', status: 'danger' },
        { statusCode: 409, messageText: 'ApiManager.Messages.AlreadyExists', status: 'danger' }
      ]
    });
    return this._apiClient.put<Api>(requestData).pipe(
      map((response: HttpResponse<Api>) => response.body!)
    );
  }

  public delete(id: string): Observable<SuccessResponseDto> {
    const requestData = new DeleteRequestData({
      endpoint: `api-manager/${id}`,
      responseMessages: [
        { statusCode: 200, messageText: 'ApiManager.Messages.DeleteSuccess', status: 'success' },
        { statusCode: 404, messageText: 'ApiManager.Messages.NotFound', status: 'danger' }
      ]
    });
    return this._apiClient.delete<SuccessResponseDto>(requestData).pipe(
      map((response: HttpResponse<SuccessResponseDto>) => response.body!)
    );
  }

  public regenerateKeys(id: string): Observable<Api> {
    const requestData = new PostRequestData({
      endpoint: `api-manager/${id}/regenerate-keys`,
      requestBody: {},
      responseMessages: [
        { statusCode: 200, messageText: 'ApiManager.Messages.KeysRegenerated', status: 'success' },
        { statusCode: 404, messageText: 'ApiManager.Messages.NotFound', status: 'danger' }
      ]
    });
    return this._apiClient.post<Api>(requestData).pipe(
      map((response: HttpResponse<Api>) => response.body!)
    );
  }
}
