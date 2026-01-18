import { Observable, of } from "rxjs";
import { HttpResponse } from "@angular/common/http";
import { IApiClientService } from "./i-api-client.service";
import { GetBlobRequestData } from "../types/get-blob-request-data";

export class ApiClientServiceStub implements IApiClientService {

  constructor(public response: any) {
  }

  public getRaw<T>(endpoint: string, options?: object): Observable<any> {
    return this.request();
  }
  public getBlob<T>(requestData: GetBlobRequestData): Observable<HttpResponse<any>> {
    return this.request();
  }
  public get<T>(): Observable<HttpResponse<any>> {
    return this.request();
  }

  public post<T>(): Observable<HttpResponse<any>> {
    return this.request();
  }

  public postFile<T>(): Observable<HttpResponse<any>> {
    return this.request();
  }

  public patch<T>(): Observable<HttpResponse<any>> {
    return this.request();
  }

  public put<T>(): Observable<HttpResponse<any>> {
    return this.request();
  }

  public delete<T>(): Observable<HttpResponse<any>> {
    return this.request();
  }

  public deleteWithBody<T>(): Observable<HttpResponse<any>> {
    return this.request();
  }

  private request(): Observable<HttpResponse<any>> {
    return of(new HttpResponse<any>({
      body: this.response
    }));
  }
}
