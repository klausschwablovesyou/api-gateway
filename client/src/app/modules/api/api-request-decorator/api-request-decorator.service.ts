import { Inject, Injectable, Optional } from '@angular/core';
import { API_RESPONSE_MESSAGE_EXCEPTIONS, IApiRequestDecoratorService } from "./i-api-request-decorator.service";
import { catchError, tap } from "rxjs/operators";
import { isNullOrUndefined } from "@app/helpers/type.helper";
import { ApiMessage } from "../types/api-message";
import { RequestData } from "../types/request-data";
import { Observable, throwError } from "rxjs";
import { HttpErrorResponse, HttpResponse, HttpResponseBase } from "@angular/common/http";
import { API_MESSAGE_SERVICE_IMPL, IApiMessageService } from "../api-message/i-api-message.service";
import { API_PROGRESS_INDICATOR_SERVICE_IMPL, IApiProgressIndicatorService } from "../api-progress-indicator/i-api-progress-indicator.service";
import { ApiStatesService } from "../api-states.service";
import { ResponseMessageException } from "../types/response-message-exception";
import { Router } from "@angular/router";

@Injectable()
export class ApiRequestDecoratorService implements IApiRequestDecoratorService {

  constructor(@Inject(API_MESSAGE_SERVICE_IMPL) @Optional() private _messageService: IApiMessageService,
              @Inject(API_PROGRESS_INDICATOR_SERVICE_IMPL) @Optional() private _progressIndicatorService: IApiProgressIndicatorService,
              @Inject(API_RESPONSE_MESSAGE_EXCEPTIONS) @Optional() private _responseMessageExceptions: ResponseMessageException[],
              private _states: ApiStatesService,
              private _router: Router) { }

  public decorateRequest<T>(requestData: RequestData, request: Observable<HttpResponse<T>>): Observable<HttpResponse<T>> {
    let isResponseHandlingNeeded = requestData.autoResponseHandling && !isNullOrUndefined(this._messageService);
    const isProgressIndicatorNeeded = requestData.progressIndication && !isNullOrUndefined(this._progressIndicatorService);
    this._states.responseInProgressText = requestData.responseInProgressText;
    if (isProgressIndicatorNeeded) {
      this._states.isResponseInProgress.set(true);
      this._progressIndicatorService.setProgressIndicatorTimeout(requestData.progressTimeout);
    }
    return request.pipe(
      tap(response => {
        isResponseHandlingNeeded = this.checkResponseHandlingExceptions(requestData, response, isResponseHandlingNeeded);

        if (isResponseHandlingNeeded) {
          this.decorateMessages(requestData, response.status, response.body);
        }

        if (isProgressIndicatorNeeded) {
          this._states.isResponseInProgress.set(false);
        }
      }),
      catchError((response: HttpErrorResponse) => {
        isResponseHandlingNeeded = this.checkResponseHandlingExceptions(requestData, response, isResponseHandlingNeeded);

        if (isResponseHandlingNeeded) {
          this.decorateMessages(requestData, response.status, response.error);
        }

        if (isProgressIndicatorNeeded) {
          this._states.isResponseInProgress.set(false);
        }
        return throwError(() => response);
      }),
    );
  }

  private checkResponseHandlingExceptions(request: RequestData, response: HttpResponseBase, isNeeded: boolean = false): boolean {
    if (isNeeded && !isNullOrUndefined(this._responseMessageExceptions)) {
      const matchedException = this._responseMessageExceptions.find(exc => this._router.url.includes(exc.url));
      return (
        matchedException === undefined ||
        matchedException.statusCode !== response.status ||
        (request.responseMessages?.some(x => x.statusCode === response.status) ?? false)
      );
    }
    return isNeeded;
  }

  private decorateMessages(requestData: RequestData, responseStatus: number, responseBody: any): void {

    const isSuccess = responseStatus >= 200 && responseStatus < 300;
    // Tries to find the related message for the statusCode of response
    let customMessage = requestData.responseMessages?.find(x => x.statusCode === responseStatus);

    // If there is no message with the statusCode of the response, and it's not a success response,
    // it tries to find a default error message (default messages have no statusCode keys)
    if (customMessage === undefined && !isSuccess) {
      customMessage = requestData.responseMessages?.find(x => x.statusCode === undefined);
    }

    let apiMessageText: string | undefined;
    // Get messageText from API response
    if (responseBody && requestData.responseMessageProperty) {
      apiMessageText = responseBody[requestData.responseMessageProperty];
    }

    let translateParams = customMessage?.translateParams;

    // append apiMessageText for translateParams if exists and there is customMessage
    if (!isNullOrUndefined(apiMessageText) && !isNullOrUndefined(customMessage?.messageText) && requestData.responseMessageProperty) {
      translateParams = Object.assign({}, customMessage?.translateParams);
      (translateParams as any)[requestData.responseMessageProperty] = apiMessageText;
    }

    const message: ApiMessage = {
      statusCode: responseStatus,
      messageText: customMessage?.messageText ?? apiMessageText,
      translateParams: translateParams
    }

    if (isNullOrUndefined(message.messageText)) {
      return;
    }

    if (customMessage?.status !== undefined) {
      message.status = customMessage.status;
    } else if (!isSuccess) {
      message.status = 'danger';
    }

    // if there is no custom message, we use api response message
    this._messageService.setMessage(message);
  }
}
