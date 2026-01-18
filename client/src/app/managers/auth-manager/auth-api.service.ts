import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpResponse } from '@angular/common/http';
import { API_CLIENT_SERVICE_IMPL, IApiClientService } from '@app/modules/api/api-client/i-api-client.service';
import { PostRequestData } from '@app/modules/api/types/post-request-data';
import { AuthRequestDto } from '@shared/dtos/auth-request.dto';
import { RegisterRequestDto } from '@shared/dtos/register-request.dto';
import { AuthResponseDto } from '@shared/dtos/auth-response.dto';

@Injectable({
  providedIn: 'root'
})
export class AuthApiService {
  constructor(
    @Inject(API_CLIENT_SERVICE_IMPL) private _apiClient: IApiClientService
  ) {}

  public login(credentials: AuthRequestDto): Observable<HttpResponse<AuthResponseDto>> {
    const requestData = new PostRequestData({
      endpoint: 'auth/login',
      requestBody: credentials,
      responseMessages: [{
        statusCode: 401,
        messageText: 'Auth.Error.InvalidCredentials',
        status: 'danger'
      }]
    });
    return this._apiClient.post<AuthResponseDto>(requestData);
  }

  public register(userData: RegisterRequestDto): Observable<HttpResponse<AuthResponseDto>> {
    const requestData = new PostRequestData({
      endpoint: 'auth/register',
      requestBody: userData,
      responseMessages: [
        { statusCode: 201, messageText: 'Auth.Register.Success', status: 'success' },
        { statusCode: 409, messageText: 'Auth.Error.UsernameExists', status: 'danger' }
      ]
    });
    return this._apiClient.post<AuthResponseDto>(requestData);
  }
}
