import {RequestData} from "../types/request-data";
import {Observable} from "rxjs";
import {HttpResponse} from "@angular/common/http";
import {InjectionToken} from "@angular/core";
import { ResponseMessageException } from "../types/response-message-exception";

export const API_REQUEST_DECORATOR_SERVICE_IMPL = new InjectionToken<IApiRequestDecoratorService>(
  "apiRequestDecoratorServiceImpl"
);

export const API_RESPONSE_MESSAGE_EXCEPTIONS = new InjectionToken<ResponseMessageException[]>(
  "apiResponseMessageExceptions"
);

export interface IApiRequestDecoratorService {
  decorateRequest<T>(requestData: RequestData, request: Observable<HttpResponse<T>>): Observable<HttpResponse<T>>
}
