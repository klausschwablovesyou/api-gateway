import { Inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { HttpResponse } from '@angular/common/http';
import { API_CLIENT_SERVICE_IMPL, IApiClientService } from '@app/modules/api/api-client/i-api-client.service';
import { GetRequestData } from '@app/modules/api/types/get-request-data';
import { PostRequestData } from '@app/modules/api/types/post-request-data';
import { PutRequestData } from '@app/modules/api/types/put-request-data';
import { DeleteRequestData } from '@app/modules/api/types/delete-request-data';
import { Ip } from '@shared/models/ip.model';
import { CreateIpDto } from '@shared/dtos/create-ip.dto';
import { UpdateIpDto } from '@shared/dtos/update-ip.dto';
import { SuccessResponseDto } from '@shared/dtos/success-response.dto';

@Injectable({
  providedIn: 'root'
})
export class IpManagerService {
  constructor(
    @Inject(API_CLIENT_SERVICE_IMPL) private readonly _apiClient: IApiClientService
  ) {}

  public getAll(): Observable<Ip[]> {
    const requestData = new GetRequestData({
      endpoint: 'ip-manager'
    });
    return this._apiClient.get<Ip[]>(requestData).pipe(
      map((response: HttpResponse<Ip[]>) => response.body || [])
    );
  }

  public getById(id: string): Observable<Ip> {
    const requestData = new GetRequestData({
      endpoint: `ip-manager/${id}`
    });
    return this._apiClient.get<Ip>(requestData).pipe(
      map((response: HttpResponse<Ip>) => response.body!)
    );
  }

  public create(dto: CreateIpDto): Observable<Ip> {
    const requestData = new PostRequestData({
      endpoint: 'ip-manager',
      requestBody: dto,
      responseMessages: [
        { statusCode: 201, messageText: 'IpManager.Messages.CreateSuccess', status: 'success' },
        { statusCode: 409, messageText: 'IpManager.Messages.AlreadyExists', status: 'danger' }
      ]
    });
    return this._apiClient.post<Ip>(requestData).pipe(
      map((response: HttpResponse<Ip>) => response.body!)
    );
  }

  public update(id: string, dto: UpdateIpDto): Observable<Ip> {
    const requestData = new PutRequestData({
      endpoint: `ip-manager/${id}`,
      requestBody: dto,
      responseMessages: [
        { statusCode: 200, messageText: 'IpManager.Messages.UpdateSuccess', status: 'success' },
        { statusCode: 404, messageText: 'IpManager.Messages.NotFound', status: 'danger' },
        { statusCode: 409, messageText: 'IpManager.Messages.AlreadyExists', status: 'danger' }
      ]
    });
    return this._apiClient.put<Ip>(requestData).pipe(
      map((response: HttpResponse<Ip>) => response.body!)
    );
  }

  public delete(id: string): Observable<SuccessResponseDto> {
    const requestData = new DeleteRequestData({
      endpoint: `ip-manager/${id}`,
      responseMessages: [
        { statusCode: 200, messageText: 'IpManager.Messages.DeleteSuccess', status: 'success' },
        { statusCode: 404, messageText: 'IpManager.Messages.NotFound', status: 'danger' }
      ]
    });
    return this._apiClient.delete<SuccessResponseDto>(requestData).pipe(
      map((response: HttpResponse<SuccessResponseDto>) => response.body!)
    );
  }
}
