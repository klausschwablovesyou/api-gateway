import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiClientService } from './api-client.service';
import { GetRequestData } from '../types/get-request-data';
import { GetBlobRequestData } from '../types/get-blob-request-data';
import { PostRequestData } from '../types/post-request-data';
import { PutRequestData } from '../types/put-request-data';
import { DeleteRequestData } from '../types/delete-request-data';
import { PatchRequestData } from '../types/patch-request-data';
import { IApiClientService } from "./i-api-client.service";
import { MockProvider } from "ng-mocks";

describe('ApiClientService HTTP methods', () => {
  let apiClientService: IApiClientService;
  let httpTestingController: HttpTestingController;

  const endpointName = 'test-endpoint';
  const endpoint = "/api/" + endpointName;
  const requestPayload = {data: 'request body'};
  const responseData = {data: 'response'};

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        MockProvider('baseUrl', () => ''),
        ApiClientService
      ]
    });
    apiClientService = TestBed.inject<IApiClientService>(ApiClientService);
    httpTestingController = TestBed.inject<HttpTestingController>(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should get raw response from getRaw method', () => {
    const options = {};
    const response = {data: 'response'};
    apiClientService.getRaw<typeof response>(endpointName, options)
      .subscribe(res => expect(res).toEqual(response));
    const req = httpTestingController.expectOne(endpoint);
    expect(req.request.method).toEqual('GET');
    req.flush(response);
  });

  it('should get response from get method', () => {
    const requestData: GetRequestData = new GetRequestData({
      endpoint: endpointName
    });

    apiClientService.get<typeof responseData>(requestData)
      .subscribe(res => expect(res.body).toEqual(responseData));
    const req = httpTestingController.expectOne(endpoint);
    expect(req.request.method).toEqual('GET');
    req.flush(responseData);
  });

  it('should get blob response from getBlob method', () => {
    const requestData: GetBlobRequestData = new GetBlobRequestData({
      endpoint: endpointName,
    });
    const response = new Blob();

    apiClientService.getBlob(requestData)
      .subscribe(res => expect(res.body).toEqual(response));
    const req = httpTestingController.expectOne(endpoint);
    expect(req.request.method).toEqual('GET');
    req.flush(response);
  });

  it('should send post request and get response from post method', () => {
    const requestData: PostRequestData = new PostRequestData({
      endpoint: endpointName,
      requestBody: requestPayload
    });

    apiClientService.post<typeof responseData>(requestData)
      .subscribe(res => expect(res.body).toEqual(responseData));
    const req = httpTestingController.expectOne(endpoint);
    expect(req.request.method).toEqual('POST');
    expect(req.request.body).toEqual(requestData.requestBody);
    req.flush(responseData);
  });

  it('should send put request and get response from put method', () => {
    const requestData: PutRequestData = new PutRequestData({
      endpoint: endpointName,
      requestBody: requestPayload
    });

    apiClientService.put<typeof responseData>(requestData)
      .subscribe(res => expect(res.body).toEqual(responseData));
    const req = httpTestingController.expectOne(endpoint);
    expect(req.request.method).toEqual('PUT');
    expect(req.request.body).toEqual(requestData.requestBody);
    req.flush(responseData);
  });

  it('should send delete request and get response from delete method', () => {
    const requestData: DeleteRequestData = new DeleteRequestData({
      endpoint: endpointName,
    });

    apiClientService.delete<typeof responseData>(requestData)
      .subscribe(res => expect(res.body).toEqual(responseData));
    const req = httpTestingController.expectOne(endpoint);
    expect(req.request.method).toEqual('DELETE');
    req.flush(responseData);
  });

  it('should send patch request and get response from patch method', () => {
    const requestData: PatchRequestData = new PatchRequestData({
      endpoint: endpointName,
      requestBody: requestPayload
    });

    apiClientService.patch<typeof responseData>(requestData)
      .subscribe(res => expect(res.body).toEqual(responseData));
    const req = httpTestingController.expectOne(endpoint);
    expect(req.request.method).toEqual('PATCH');
    expect(req.request.body).toEqual(requestData.requestBody);
    req.flush(responseData);
  });
});
