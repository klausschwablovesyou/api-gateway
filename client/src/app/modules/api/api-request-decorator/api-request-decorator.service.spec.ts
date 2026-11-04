import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';
import { ApiRequestDecoratorService } from './api-request-decorator.service';
import { ApiStatesService } from '../api-states.service';
import { IApiMessageService } from '../api-message/i-api-message.service';
import { IApiProgressIndicatorService } from '../api-progress-indicator/i-api-progress-indicator.service';
import { ApiMessage } from '../types/api-message';
import { GetRequestData } from '../types/get-request-data';
import { ResponseMessageException } from '../types/response-message-exception';

describe('ApiRequestDecoratorService', () => {
  let messages: jasmine.SpyObj<IApiMessageService>;
  let progress: jasmine.SpyObj<IApiProgressIndicatorService>;
  let states: ApiStatesService;
  let service: ApiRequestDecoratorService;

  const create = (exceptions: ResponseMessageException[] = [], url = '/apis') => new ApiRequestDecoratorService(
    messages,
    progress,
    exceptions,
    states,
    { url } as Router
  );

  const request = (responseMessages?: ApiMessage[], extra: Partial<GetRequestData> = {}) =>
    new GetRequestData({ endpoint: 'x', responseMessages, ...extra });

  const ok = (status = 200, body: unknown = {}) => of(new HttpResponse({ status, body }));

  const failed = (status: number, error: unknown = {}): Observable<HttpResponse<unknown>> =>
    throwError(() => new HttpErrorResponse({ status, error }));

  /** Subscribes and swallows the (expected) error. */
  const run = (source: Observable<unknown>) => source.subscribe({ error: () => {} });

  beforeEach(() => {
    messages = jasmine.createSpyObj<IApiMessageService>('IApiMessageService', ['setMessage']);
    progress = jasmine.createSpyObj<IApiProgressIndicatorService>('IApiProgressIndicatorService', ['setProgressIndicatorTimeout']);
    states = new ApiStatesService();
    service = create();
  });

  describe('passing the response through', () => {
    it('should emit the original response', () => {
      const response = new HttpResponse({ status: 200, body: { a: 1 } });
      let emitted: unknown;

      service.decorateRequest(request(), of(response)).subscribe(value => (emitted = value));

      expect(emitted).toBe(response);
    });

    it('should rethrow the original error', () => {
      const error = new HttpErrorResponse({ status: 500 });
      let thrown: unknown;

      service.decorateRequest(request(), throwError(() => error)).subscribe({ error: value => (thrown = value) });

      expect(thrown).toBe(error);
    });
  });

  describe('progress indication', () => {
    it('should be in progress until the response arrives', () => {
      const pending = new Subject<HttpResponse<unknown>>();
      run(service.decorateRequest(request(), pending));

      expect(states.isResponseInProgress.value).toBeTrue();

      pending.next(new HttpResponse({ status: 200 }));

      expect(states.isResponseInProgress.value).toBeFalse();
    });

    it('should stop being in progress after an error', () => {
      run(service.decorateRequest(request(), failed(500)));

      expect(states.isResponseInProgress.value).toBeFalse();
    });

    it('should start the indicator timeout with the timeout of the request', () => {
      run(service.decorateRequest(request(undefined, { progressTimeout: 1234 }), ok()));

      expect(progress.setProgressIndicatorTimeout).toHaveBeenCalledOnceWith(1234);
    });

    it('should do nothing when the request disables it', () => {
      const pending = new Subject<HttpResponse<unknown>>();

      run(service.decorateRequest(request(undefined, { progressIndication: false }), pending));

      expect(states.isResponseInProgress.value).toBeFalse();
      expect(progress.setProgressIndicatorTimeout).not.toHaveBeenCalled();
    });

    it('should publish the text of the request', () => {
      run(service.decorateRequest(request(undefined, { responseInProgressText: 'Saving...' }), ok()));

      expect(states.responseInProgressText).toBe('Saving...');
    });

    it('should work without a progress service', () => {
      const decorator = new ApiRequestDecoratorService(messages, null as never, [], states, { url: '/' } as Router);

      expect(() => run(decorator.decorateRequest(request(), ok()))).not.toThrow();
      expect(states.isResponseInProgress.value).toBeFalse();
    });
  });

  describe('response messages', () => {
    it('should show the custom message matching a success status', () => {
      run(service.decorateRequest(request([{ statusCode: 201, messageText: 'Created', status: 'success' }]), ok(201)));

      expect(messages.setMessage).toHaveBeenCalledOnceWith(jasmine.objectContaining({
        statusCode: 201,
        messageText: 'Created',
        status: 'success'
      }));
    });

    it('should show the custom message matching an error status', () => {
      run(service.decorateRequest(request([{ statusCode: 409, messageText: 'Exists', status: 'danger' }]), failed(409)));

      expect(messages.setMessage).toHaveBeenCalledOnceWith(jasmine.objectContaining({
        statusCode: 409,
        messageText: 'Exists',
        status: 'danger'
      }));
    });

    it('should not show a message when no custom message matches the status', () => {
      run(service.decorateRequest(request([{ statusCode: 409, messageText: 'Exists' }]), ok(200)));

      expect(messages.setMessage).not.toHaveBeenCalled();
    });

    it('should not show a message when the request disables response handling', () => {
      const data = request([{ statusCode: 200, messageText: 'Done' }], { autoResponseHandling: false });

      run(service.decorateRequest(data, ok(200)));

      expect(messages.setMessage).not.toHaveBeenCalled();
    });

    it('should work without a message service', () => {
      const decorator = new ApiRequestDecoratorService(null as never, progress, [], states, { url: '/' } as Router);

      expect(() => run(decorator.decorateRequest(request([{ statusCode: 200, messageText: 'Done' }]), ok(200)))).not.toThrow();
    });

    it('should add the message of the API response to the translate params', () => {
      const data = request([{ statusCode: 200, messageText: 'Done', translateParams: { name: 'x' } }]);

      run(service.decorateRequest(data, ok(200, { message: 'from api' })));

      expect(messages.setMessage).toHaveBeenCalledOnceWith(jasmine.objectContaining({
        translateParams: { name: 'x', message: 'from api' }
      }));
    });

    it('should not modify the translate params of the request', () => {
      const translateParams = { name: 'x' };

      run(service.decorateRequest(request([{ statusCode: 200, messageText: 'Done', translateParams }]), ok(200, { message: 'from api' })));

      expect(translateParams).toEqual({ name: 'x' });
    });

    it('should keep the translate params when the response has no message', () => {
      const data = request([{ statusCode: 200, messageText: 'Done', translateParams: { name: 'x' } }]);

      run(service.decorateRequest(data, ok(200, {})));

      expect(messages.setMessage).toHaveBeenCalledOnceWith(jasmine.objectContaining({ translateParams: { name: 'x' } }));
    });

    it('should fall back to the default error message, which has no status code', () => {
      run(service.decorateRequest(request([{ messageText: 'Default error' }]), failed(500)));

      expect(messages.setMessage).toHaveBeenCalledOnceWith(jasmine.objectContaining({
        messageText: 'Default error',
        status: 'danger'
      }));
    });

    for (const status of [200, 201]) {
      it(`should not use the default error message for a ${status} response`, () => {
        run(service.decorateRequest(request([{ messageText: 'Default error' }]), ok(status)));

        expect(messages.setMessage).not.toHaveBeenCalled();
      });
    }

    it('should fall back to the message of a successful API response', () => {
      run(service.decorateRequest(request(), ok(200, { message: 'from api' })));

      const message = messages.setMessage.calls.mostRecent().args[0];
      expect(message.messageText).toBe('from api');
      expect(message.status).toBeUndefined();
    });

    it('should fall back to the message in the error body, marked as danger', () => {
      run(service.decorateRequest(request(), failed(404, { statusCode: 404, message: '404 - API not found' })));

      expect(messages.setMessage).toHaveBeenCalledOnceWith(jasmine.objectContaining({
        statusCode: 404,
        messageText: '404 - API not found',
        status: 'danger'
      }));
    });

    it('should show nothing when an error has no message, instead of the technical HTTP text', () => {
      run(service.decorateRequest(request(), failed(500, null)));

      expect(messages.setMessage).not.toHaveBeenCalled();
    });
  });

  describe('message exceptions', () => {
    const exceptions: ResponseMessageException[] = [{ statusCode: 401, url: '/login' }];

    it('should not show a message for an excepted status on the excepted page', () => {
      run(create(exceptions, '/login').decorateRequest(request(), failed(401, { message: 'Unauthorized' })));

      expect(messages.setMessage).not.toHaveBeenCalled();
    });

    it('should show the API message for the same status on other pages', () => {
      run(create(exceptions, '/apis').decorateRequest(request(), failed(401, { message: 'Unauthorized' })));

      expect(messages.setMessage).toHaveBeenCalledTimes(1);
    });

    it('should still show a custom message the request defines for that status', () => {
      const data = request([{ statusCode: 401, messageText: 'Invalid credentials' }]);

      run(create(exceptions, '/login').decorateRequest(data, failed(401)));

      expect(messages.setMessage).toHaveBeenCalledTimes(1);
    });

    it('should not apply to other statuses on the excepted page', () => {
      const data = request([{ statusCode: 500, messageText: 'Server error' }]);

      run(create(exceptions, '/login').decorateRequest(data, failed(500)));

      expect(messages.setMessage).toHaveBeenCalledTimes(1);
    });

    it('should not apply to other pages', () => {
      const data = request([{ statusCode: 401, messageText: 'Session expired' }]);

      run(create(exceptions, '/apis').decorateRequest(data, failed(401)));

      expect(messages.setMessage).toHaveBeenCalledTimes(1);
    });

    it('should work when no exceptions are configured', () => {
      const decorator = new ApiRequestDecoratorService(messages, progress, null as never, states, { url: '/' } as Router);

      run(decorator.decorateRequest(request([{ statusCode: 200, messageText: 'Done' }]), ok(200)));

      expect(messages.setMessage).toHaveBeenCalledTimes(1);
    });
  });
});
