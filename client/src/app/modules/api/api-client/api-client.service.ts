import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from "@angular/common/http";
import { Observable } from "rxjs";
import { IApiClientService } from "./i-api-client.service";
import { Inject, Injectable, Optional } from "@angular/core";
import { GetRequestData } from "../types/get-request-data";
import { GetBlobRequestData } from "../types/get-blob-request-data";
import { PostRequestData } from "../types/post-request-data";
import { PutRequestData } from "../types/put-request-data";
import { DeleteRequestData } from "../types/delete-request-data";
import { PatchRequestData } from "../types/patch-request-data";
import { RequestData } from "../types/request-data";
import { API_REQUEST_DECORATOR_SERVICE_IMPL, IApiRequestDecoratorService } from "../api-request-decorator/i-api-request-decorator.service";
import { isNullOrUndefined } from "@app/helpers/type.helper";
import { PostFileRequestData } from "../types/post-file-request-data";

@Injectable()
export class ApiClientService implements IApiClientService {

  constructor(
    private _httpClient: HttpClient,
    @Inject('baseUrl') @Optional() private _getBaseUrl: Function,
    @Inject(API_REQUEST_DECORATOR_SERVICE_IMPL) @Optional() private _requestDecoratorService: IApiRequestDecoratorService) {}

  public getRaw<T>(endpoint: string, options?: object, customBaseUrl?: string): Observable<T> {
    options = { ...options, withCredentials: true };
    return this._httpClient.get<T>(this.getAPIUrl(endpoint, customBaseUrl), options);
  }

  public get<T>(requestData: GetRequestData): Observable<HttpResponse<T>> {
    const request = this._httpClient.get<T>(this.getAPIUrl(requestData.endpoint, requestData.customBaseUrl), {
      observe: "response",
      withCredentials: true,
      headers: requestData.headers,
      params: this.prepareRequestParams(requestData.params || {})
    });
    return this.decorateRequest<T>(requestData, request);
  }

  public getBlob(requestData: GetBlobRequestData): Observable<HttpResponse<Blob>> {
    const request = this._httpClient.get(this.getAPIUrl(requestData.endpoint, requestData.customBaseUrl), {
      observe: "response",
      responseType: "blob",
      withCredentials: true,
      params: this.prepareRequestParams(requestData.params || {})
    });

    return this.decorateRequest<Blob>(requestData, request);
  }

  public post<T>(requestData: PostRequestData): Observable<HttpResponse<T>> {
    const request = this._httpClient.post<T>(this.getAPIUrl(requestData.endpoint, requestData.customBaseUrl), requestData.requestBody, {
      params: this.prepareRequestParams(requestData.params || {}),
      observe: "response",
      withCredentials: true,
      headers: requestData.headers
    });

    return this.decorateRequest(requestData, request);
  }

  public postFile<T>(requestData: PostFileRequestData): Observable<HttpResponse<T>> {
    requestData.headers = new HttpHeaders();
    requestData.headers.append('Content-Type', 'multipart/form-data');

    const formData = new FormData;
    formData.append(requestData.fileFormName || 'file', requestData.file);
    requestData.requestBody = formData;

    return this.post(requestData);
  }

  public put<T>(requestData: PutRequestData): Observable<HttpResponse<T>> {
    const request = this._httpClient.put<T>(this.getAPIUrl(requestData.endpoint, requestData.customBaseUrl), requestData.requestBody, {
      observe: "response",
      withCredentials: true,
      headers: requestData.headers
    });

    return this.decorateRequest(requestData, request);
  }

  public delete<T>(requestData: DeleteRequestData): Observable<HttpResponse<T>> {
    const request = this._httpClient.delete<T>(this.getAPIUrl(requestData.endpoint, requestData.customBaseUrl,), {
      observe: "response",
      withCredentials: true,
      headers: requestData.headers
    });

    return this.decorateRequest(requestData, request);
  }

  public deleteWithBody<T>(requestData: DeleteRequestData): Observable<HttpResponse<T>> {
    const request = this._httpClient.request<T>('DELETE',
      this.getAPIUrl(requestData.endpoint, requestData.customBaseUrl), {
      body: requestData.requestBody,
      observe: "response",
      withCredentials: true,
      headers: requestData.headers
    });

    return this.decorateRequest(requestData, request);
  }

  public patch<T>(requestData: PatchRequestData): Observable<HttpResponse<T>> {
    const request = this._httpClient.patch<T>(this.getAPIUrl(requestData.endpoint, requestData.customBaseUrl), requestData.requestBody, {
      observe: "response",
      withCredentials: true,
      headers: requestData.headers
    });

    return this.decorateRequest(requestData, request);
  }

  private getAPIUrl(endpoint: string, customBaseUrl?: string): string {
    if (customBaseUrl) {
      return `${customBaseUrl}/${endpoint}`;
    }
    const baseUrl = '/api/';
    return `${baseUrl}${endpoint}`;
  }

  private decorateRequest<T>(requestData: RequestData, request: Observable<HttpResponse<T>>): Observable<HttpResponse<T>> {
    if (!isNullOrUndefined(this._requestDecoratorService)) {
      return this._requestDecoratorService.decorateRequest<T>(requestData, request);
    }
    return request;
  }

  private prepareRequestParams(params: HttpParams | object): HttpParams | undefined {
    if (isNullOrUndefined(params)) {
      return undefined;
    }

    if (!(params instanceof HttpParams)) {
      return new HttpParams({
        fromObject: {
          ...params
        }
      });
    }
    return params;
  }
}
