import { ApiRequestDecoratorService } from './api-request-decorator.service';
import { ApiStatesService } from "../api-states.service";
import { IApiMessageService } from "../api-message/i-api-message.service";
import { IApiProgressIndicatorService } from "../api-progress-indicator/i-api-progress-indicator.service";
import { HttpErrorResponse, HttpResponse } from "@angular/common/http";
import { of, throwError } from "rxjs";
import { RequestData } from "../types/request-data";
import { ApiMessage } from "../types/api-message";

describe('ApiRequestDecoratorService', () => {
  let service: ApiRequestDecoratorService;
  let messageService: IApiMessageService;
  let progressIndicatorService: IApiProgressIndicatorService;
  let states: ApiStatesService;
  let requestData: RequestData;

  beforeEach(() => {
    messageService = {setMessage: jest.fn()} as IApiMessageService;
    progressIndicatorService = {setProgressIndicatorTimeout: jest.fn()} as IApiProgressIndicatorService;
    requestData = {
      endpoint: "",
    };
    states = new ApiStatesService();
    service = new ApiRequestDecoratorService(
      messageService,
      progressIndicatorService,
      states,
    );
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call decorateMessages when autoResponseHandling is true and the response is successful', () => {
    requestData.autoResponseHandling = true;
    const requestBody = { message: 'Success' };
    const requestStatus = 200;
    const request = of(new HttpResponse({ body: requestBody, status: requestStatus }));
    jest.spyOn(service as any, 'decorateMessages');
    service.decorateRequest(requestData, request).subscribe(() => {
      expect(service['decorateMessages']).toHaveBeenCalledWith(requestData, requestStatus, requestBody);
    });
  });

  it('should call decorateMessages when autoResponseHandling is true and there is error response', () => {
    requestData.autoResponseHandling = true;
    const requestBody = { error: 'Success' };
    const requestStatus = 404;
    const request = throwError(new HttpErrorResponse({ error: requestBody, status: requestStatus }));
    jest.spyOn(service as any, 'decorateMessages');
    service.decorateRequest(requestData, request).subscribe({
      next: null,
      error: () => {
      expect(service['decorateMessages']).toHaveBeenCalledWith(requestData, requestStatus, requestBody);
    }});
  });

  it('should call setMessage on successful api response', () => {
    const request = of(new HttpResponse({body: {message: 'Success'}, status: 200}));
    service.decorateRequest(requestData, request).subscribe(() => {
      expect(messageService.setMessage).toHaveBeenCalled();
      expect(states.isResponseInProgress.value).toBe(false);
    });
  });

  it('should call setMessage on api response error', () => {
    const request = throwError(new HttpErrorResponse({error: {message: 'Error'}, status: 400}));
    service.decorateRequest(requestData, request).subscribe(
      () => {
      },
      () => {
        expect(messageService.setMessage).toHaveBeenCalled();
        expect(states.isResponseInProgress.value).toBe(false);
      }
    );
  });

  it('should call setProgressIndicatorTimeout if needed', () => {
    requestData = {
      endpoint: "",
      progressIndication: true,
      progressTimeout: 1000,
      responseInProgressText: 'Loading...'
    };
    const request = of(new HttpResponse({body: {message: 'Success'}, status: 200}));
    service.decorateRequest(requestData, request).subscribe(() => {
      expect(progressIndicatorService.setProgressIndicatorTimeout).toHaveBeenCalledWith(1000);
      expect(states.isResponseInProgress.value).toBe(false);
    });
  });

  it('should handle custom response messages', () => {
    requestData = {
      endpoint: "",
      responseMessages: [{ statusCode: 200, messageText: 'Custom Success' }]
    };
    const request = of(new HttpResponse({ body: { message: 'Success' }, status: 200 }));
    service.decorateRequest(requestData, request).subscribe(() => {
      expect(messageService.setMessage).toHaveBeenCalledWith({ statusCode: 200, messageText: requestData.responseMessages[0].messageText });
      expect(states.isResponseInProgress.value).toBe(false);
    });
  });

  it('should handle default error response messages', () => {
    requestData = {
      endpoint: "",
      responseMessages: [
        {
          statusCode: undefined,
          messageText: 'Default (error) message'
        }
      ]
    };
    const request = throwError(new HttpErrorResponse({ error: { message: 'Something happened' }, status: 500 }));
    service.decorateRequest(requestData, request).subscribe({
      next: null, error: _ => {
        expect(messageService.setMessage).toHaveBeenCalledWith({
          statusCode: undefined,
          messageText: requestData.responseMessages.find(x => x.statusCode === undefined).messageText
        });

        expect(states.isResponseInProgress.value).toBe(false);
      }
    });
  });

  it('should handle api response messages', () => {
    requestData = {
      endpoint: "",
      responseMessageProperty: 'message',
    };
    const apiResponseStatus = 200;
    const apiReponseMessage = 'Success';

    const request = of(new HttpResponse({ body: { message: apiReponseMessage }, status: apiResponseStatus }));
    service.decorateRequest(requestData, request).subscribe(() => {
      expect(messageService.setMessage).toHaveBeenCalledWith({ statusCode: apiResponseStatus, messageText: apiReponseMessage });
      expect(states.isResponseInProgress.value).toBe(false);
    });
  });

  it('should handle api error response messages', () => {
    requestData = {
      endpoint: "",
      responseMessageProperty: 'error',
    };

    const apiReponseMessage = 'Resource not found';
    const apiResponseStatus = 404;

    const request = throwError(new HttpErrorResponse({ error: apiReponseMessage, status: apiResponseStatus }));
    service.decorateRequest(requestData, request).subscribe({
      error: error => {
        expect(messageService.setMessage).toHaveBeenCalledWith({ statusCode: error.status, messageText: apiReponseMessage });
        expect(states.isResponseInProgress.value).toBe(false);
      }
    });
  });

  it('should handle custom response messages with translateParams where api response message appended to', () => {
    const statusCode = 500;
    requestData = {
      endpoint: "",
      responseMessages: [
        {
          statusCode: statusCode,
          messageText: 'Error message is: '
        }
      ],
      responseMessageProperty: 'message',
    };

    const responseData = {};
    responseData[requestData.responseMessageProperty] = 'Something happened';

    const request = throwError(new HttpErrorResponse({ error: responseData, status: statusCode }));

    service.decorateRequest(requestData, request).subscribe({
      error: () => {
        const responseMessage = requestData.responseMessages.find(x => x.statusCode === statusCode);
        const messageData: ApiMessage = {
          statusCode: statusCode,
          messageText: responseMessage.messageText,
          translateParams: responseData
        }

        expect(messageService.setMessage).toHaveBeenCalledWith(messageData);
        expect(states.isResponseInProgress.value).toBe(false);
      }
    });
  });
});
