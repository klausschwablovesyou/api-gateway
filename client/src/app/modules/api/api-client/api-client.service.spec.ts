import { TestBed } from '@angular/core/testing';
import { HttpHeaders, HttpParams, HttpResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { GetRequestData } from '../types/get-request-data';
import { GetBlobRequestData } from '../types/get-blob-request-data';
import { PostRequestData } from '../types/post-request-data';
import { PostFileRequestData } from '../types/post-file-request-data';
import { PutRequestData } from '../types/put-request-data';
import { DeleteRequestData } from '../types/delete-request-data';
import { PatchRequestData } from '../types/patch-request-data';
import { API_REQUEST_DECORATOR_SERVICE_IMPL, IApiRequestDecoratorService } from '../api-request-decorator/i-api-request-decorator.service';

describe('ApiClientService', () => {
  const endpoint = 'test-endpoint';
  const url = `/api/${endpoint}`;
  const requestBody = { data: 'request body' };
  const responseBody = { data: 'response' };

  function setup(decorator?: IApiRequestDecoratorService) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ApiClientService,
        ...(decorator ? [{ provide: API_REQUEST_DECORATOR_SERVICE_IMPL, useValue: decorator }] : [])
      ]
    });
    return {
      client: TestBed.inject(ApiClientService),
      http: TestBed.inject(HttpTestingController)
    };
  }

  describe('HTTP methods', () => {
    let client: ApiClientService;
    let http: HttpTestingController;

    beforeEach(() => ({ client, http } = setup()));

    afterEach(() => http.verify());

    it('getRaw should return the body itself, with credentials', () => {
      let result: unknown;

      client.getRaw<typeof responseBody>(endpoint, { headers: { 'X-Test': 'yes' } }).subscribe(value => (result = value));

      const call = http.expectOne(url);
      expect(call.request.method).toBe('GET');
      expect(call.request.withCredentials).toBeTrue();
      expect(call.request.headers.get('X-Test')).toBe('yes');
      call.flush(responseBody);
      expect(result).toEqual(responseBody);
    });

    it('get should return the full response', () => {
      let result: HttpResponse<unknown> | undefined;

      client.get(new GetRequestData({ endpoint })).subscribe(value => (result = value));

      const call = http.expectOne(url);
      expect(call.request.method).toBe('GET');
      expect(call.request.withCredentials).toBeTrue();
      call.flush(responseBody);
      expect(result?.body).toEqual(responseBody);
      expect(result?.status).toBe(200);
    });

    it('get should send headers', () => {
      client.get(new GetRequestData({ endpoint, headers: new HttpHeaders({ 'X-Test': 'yes' }) })).subscribe();

      const call = http.expectOne(url);
      expect(call.request.headers.get('X-Test')).toBe('yes');
      call.flush({});
    });

    it('get should accept params as a plain object', () => {
      client.get(new GetRequestData({ endpoint, params: { page: 2, q: 'a' } })).subscribe();

      const call = http.expectOne(request => request.url === url);
      expect(call.request.params.get('page')).toBe('2');
      expect(call.request.params.get('q')).toBe('a');
      call.flush({});
    });

    it('get should accept HttpParams', () => {
      const params = new HttpParams().set('page', '3');

      client.get(new GetRequestData({ endpoint, params })).subscribe();

      const call = http.expectOne(request => request.url === url);
      expect(call.request.params.get('page')).toBe('3');
      call.flush({});
    });

    it('should use a custom base URL when given', () => {
      client.get(new GetRequestData({ endpoint, customBaseUrl: 'https://other.example.com' })).subscribe();

      http.expectOne(`https://other.example.com/${endpoint}`).flush({});
    });

    it('getBlob should request a blob', () => {
      let result: HttpResponse<Blob> | undefined;
      const blob = new Blob(['content']);

      client.getBlob(new GetBlobRequestData({ endpoint })).subscribe(value => (result = value));

      const call = http.expectOne(url);
      expect(call.request.responseType).toBe('blob');
      expect(call.request.withCredentials).toBeTrue();
      call.flush(blob);
      expect(result?.body).toBe(blob);
    });

    it('post should send the body', () => {
      let result: HttpResponse<unknown> | undefined;

      client.post(new PostRequestData({ endpoint, requestBody, params: { a: '1' } })).subscribe(value => (result = value));

      const call = http.expectOne(request => request.url === url);
      expect(call.request.method).toBe('POST');
      expect(call.request.body).toEqual(requestBody);
      expect(call.request.params.get('a')).toBe('1');
      expect(call.request.withCredentials).toBeTrue();
      call.flush(responseBody);
      expect(result?.body).toEqual(responseBody);
    });

    it('postFile should post form data, leaving the content type to the browser', () => {
      const file = new File(['content'], 'test.txt');

      client.postFile(new PostFileRequestData({ endpoint, file, fileFormName: 'upload' })).subscribe();

      const call = http.expectOne(url);
      expect(call.request.method).toBe('POST');
      expect(call.request.body instanceof FormData).toBeTrue();
      expect((call.request.body as FormData).get('upload')).toEqual(jasmine.any(File));
      expect(call.request.headers.has('Content-Type')).toBeFalse();
      call.flush({});
    });

    it('postFile should use "file" as the default form name', () => {
      client.postFile(new PostFileRequestData({ endpoint, file: new File(['x'], 'test.txt') })).subscribe();

      const call = http.expectOne(url);
      expect((call.request.body as FormData).has('file')).toBeTrue();
      call.flush({});
    });

    it('put should send the body', () => {
      client.put(new PutRequestData({ endpoint, requestBody })).subscribe();

      const call = http.expectOne(url);
      expect(call.request.method).toBe('PUT');
      expect(call.request.body).toEqual(requestBody);
      expect(call.request.withCredentials).toBeTrue();
      call.flush({});
    });

    it('patch should send the body', () => {
      client.patch(new PatchRequestData({ endpoint, requestBody })).subscribe();

      const call = http.expectOne(url);
      expect(call.request.method).toBe('PATCH');
      expect(call.request.body).toEqual(requestBody);
      call.flush({});
    });

    it('delete should not send a body', () => {
      client.delete(new DeleteRequestData({ endpoint })).subscribe();

      const call = http.expectOne(url);
      expect(call.request.method).toBe('DELETE');
      expect(call.request.body).toBeNull();
      expect(call.request.withCredentials).toBeTrue();
      call.flush({});
    });

    it('deleteWithBody should send the body', () => {
      client.deleteWithBody(new DeleteRequestData({ endpoint, requestBody })).subscribe();

      const call = http.expectOne(url);
      expect(call.request.method).toBe('DELETE');
      expect(call.request.body).toEqual(requestBody);
      call.flush({});
    });
  });

  describe('request decorator', () => {
    it('should pass each request through the decorator', () => {
      const decorated = new Observable<HttpResponse<unknown>>();
      const decorator = jasmine.createSpyObj<IApiRequestDecoratorService>('Decorator', ['decorateRequest']);
      decorator.decorateRequest.and.returnValue(decorated as never);
      const { client } = setup(decorator);
      const data = new GetRequestData({ endpoint });

      expect(client.get(data) as unknown).toBe(decorated);
      expect(decorator.decorateRequest).toHaveBeenCalledOnceWith(data, jasmine.any(Observable));
    });

    it('should not decorate getRaw', () => {
      const decorator = jasmine.createSpyObj<IApiRequestDecoratorService>('Decorator', ['decorateRequest']);
      const { client, http } = setup(decorator);

      client.getRaw(endpoint).subscribe();

      expect(decorator.decorateRequest).not.toHaveBeenCalled();
      http.expectOne(url).flush({});
    });
  });
});
