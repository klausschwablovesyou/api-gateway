import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { HttpResponse } from "@angular/common/http";
import { GetRequestData } from "../types/get-request-data";
import { GetBlobRequestData } from "../types/get-blob-request-data";
import { PostRequestData } from "../types/post-request-data";
import { PutRequestData } from "../types/put-request-data";
import { DeleteRequestData } from "../types/delete-request-data";
import { PatchRequestData } from "../types/patch-request-data";
import { PostFileRequestData } from "../types/post-file-request-data";

export const API_CLIENT_SERVICE_IMPL = new InjectionToken<IApiClientService>(
  "apiClientServiceImpl"
);

export interface IApiClientService {
  getRaw<T>(endpoint: string, options?: object): Observable<T>;
  get<T>(requestData: GetRequestData): Observable<HttpResponse<T>>;
  getBlob<T>(requestData: GetBlobRequestData): Observable<HttpResponse<any | T>>;
  post<T>(requestData: PostRequestData): Observable<HttpResponse<T>>;
  postFile<T>(requestData: PostFileRequestData): Observable<HttpResponse<T>>;
  put<T>(requestData: PutRequestData): Observable<HttpResponse<T>>;
  delete<T>(requestData: DeleteRequestData): Observable<HttpResponse<T>>;
  deleteWithBody<T>(requestData: DeleteRequestData): Observable<HttpResponse<T>>;
  patch<T>(requestData: PatchRequestData): Observable<HttpResponse<T>>;
}
