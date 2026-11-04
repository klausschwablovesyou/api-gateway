import { HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { ApiManagerService } from './api-manager/api-manager.service';
import { AuthApiService } from './auth-manager/auth-api.service';
import { ConfigApiService } from './config-manager/config-api.service';
import { ConfigManagerService } from './config-manager/config-manager.service';
import { ConfigStatesService } from './config-manager/config-states.service';
import { IpManagerService } from './ip-manager/ip-manager.service';
import { RequestLogManagerService } from './request-log-manager/request-log-manager.service';
import { IApiClientService } from '../modules/api/api-client/i-api-client.service';
import { GetRequestData } from '../modules/api/types/get-request-data';
import { PostRequestData } from '../modules/api/types/post-request-data';
import { PutRequestData } from '../modules/api/types/put-request-data';
import { DeleteRequestData } from '../modules/api/types/delete-request-data';
import { CreateApiDto } from '@shared/dtos/create-api.dto';

describe('API managers', () => {
  let client: jasmine.SpyObj<IApiClientService>;

  /** Makes every client method answer with the given body. */
  function respondWith(body: unknown): void {
    const answer = of(new HttpResponse({ body }));
    client.get.and.returnValue(answer as never);
    client.post.and.returnValue(answer as never);
    client.put.and.returnValue(answer as never);
    client.delete.and.returnValue(answer as never);
  }

  function emitted<T>(source: { subscribe(next: (value: T) => void): unknown }): T {
    let value!: T;
    source.subscribe(next => (value = next));
    return value;
  }

  const messageFor = (request: { responseMessages?: Array<{ statusCode?: number; messageText?: string; status?: string }> }, code: number) =>
    request.responseMessages?.find(message => message.statusCode === code);

  beforeEach(() => {
    client = jasmine.createSpyObj<IApiClientService>('IApiClientService', ['get', 'post', 'put', 'delete']);
  });

  describe('ApiManagerService', () => {
    let service: ApiManagerService;
    const dto = { name: 'weather' } as CreateApiDto;

    beforeEach(() => {
      service = new ApiManagerService(client);
    });

    it('getAll should read the list', () => {
      respondWith([{ id: 'api-1' }]);

      expect(emitted(service.getAll())).toEqual([{ id: 'api-1' }] as never);
      const request = client.get.calls.mostRecent().args[0];
      expect(request).toBeInstanceOf(GetRequestData);
      expect(request.endpoint).toBe('api-manager');
    });

    it('getAll should fall back to an empty list', () => {
      respondWith(null);

      expect(emitted(service.getAll())).toEqual([]);
    });

    it('getById should read one API', () => {
      respondWith({ id: 'api-1' });

      expect(emitted(service.getById('api-1'))).toEqual({ id: 'api-1' } as never);
      expect(client.get.calls.mostRecent().args[0].endpoint).toBe('api-manager/api-1');
    });

    it('create should post the DTO and define its messages', () => {
      respondWith({ id: 'api-1' });

      expect(emitted(service.create(dto))).toEqual({ id: 'api-1' } as never);
      const request = client.post.calls.mostRecent().args[0];
      expect(request).toBeInstanceOf(PostRequestData);
      expect(request.endpoint).toBe('api-manager');
      expect(request.requestBody).toBe(dto);
      expect(messageFor(request, 201)?.messageText).toBe('ApiManager.Messages.CreateSuccess');
      expect(messageFor(request, 409)?.status).toBe('danger');
    });

    it('update should put the DTO to the API', () => {
      respondWith({ id: 'api-1' });

      expect(emitted(service.update('api-1', dto))).toEqual({ id: 'api-1' } as never);
      const request = client.put.calls.mostRecent().args[0];
      expect(request).toBeInstanceOf(PutRequestData);
      expect(request.endpoint).toBe('api-manager/api-1');
      expect(request.requestBody).toBe(dto);
      expect(messageFor(request, 200)?.messageText).toBe('ApiManager.Messages.UpdateSuccess');
      expect(messageFor(request, 404)?.messageText).toBe('ApiManager.Messages.NotFound');
      expect(messageFor(request, 409)?.messageText).toBe('ApiManager.Messages.AlreadyExists');
    });

    it('delete should target the API', () => {
      respondWith({ success: true });

      expect(emitted(service.delete('api-1'))).toEqual({ success: true } as never);
      const request = client.delete.calls.mostRecent().args[0];
      expect(request).toBeInstanceOf(DeleteRequestData);
      expect(request.endpoint).toBe('api-manager/api-1');
      expect(messageFor(request, 200)?.messageText).toBe('ApiManager.Messages.DeleteSuccess');
    });

    it('regenerateKeys should post to the keys endpoint', () => {
      respondWith({ id: 'api-2' });

      expect(emitted(service.regenerateKeys('api-1'))).toEqual({ id: 'api-2' } as never);
      expect(client.post.calls.mostRecent().args[0].endpoint).toBe('api-manager/api-1/regenerate-keys');
    });
  });

  describe('IpManagerService', () => {
    let service: IpManagerService;
    const dto = { ip: '1.1.1.1' };

    beforeEach(() => {
      service = new IpManagerService(client);
    });

    it('getAll should read the list, falling back to an empty one', () => {
      respondWith([{ id: 'ip-1' }]);
      expect(emitted(service.getAll())).toEqual([{ id: 'ip-1' }] as never);
      expect(client.get.calls.mostRecent().args[0].endpoint).toBe('ip-manager');

      respondWith(null);
      expect(emitted(service.getAll())).toEqual([]);
    });

    it('getById should read one IP', () => {
      respondWith({ id: 'ip-1' });

      expect(emitted(service.getById('ip-1'))).toEqual({ id: 'ip-1' } as never);
      expect(client.get.calls.mostRecent().args[0].endpoint).toBe('ip-manager/ip-1');
    });

    it('sync should post to the sync endpoint without canned messages', () => {
      respondWith({ total: 2 });

      expect(emitted(service.sync())).toEqual({ total: 2 } as never);
      const request = client.post.calls.mostRecent().args[0];
      expect(request.endpoint).toBe('ip-manager/sync');
      expect(request.responseMessages).toBeUndefined();
    });

    it('create should post the DTO and define its messages', () => {
      respondWith({ id: 'ip-1' });

      expect(emitted(service.create(dto))).toEqual({ id: 'ip-1' } as never);
      const request = client.post.calls.mostRecent().args[0];
      expect(request.endpoint).toBe('ip-manager');
      expect(request.requestBody).toBe(dto);
      expect(messageFor(request, 201)?.messageText).toBe('IpManager.Messages.CreateSuccess');
      expect(messageFor(request, 409)?.messageText).toBe('IpManager.Messages.AlreadyExists');
    });

    it('update should put the DTO to the IP', () => {
      respondWith({ id: 'ip-1' });

      expect(emitted(service.update('ip-1', dto))).toEqual({ id: 'ip-1' } as never);
      const request = client.put.calls.mostRecent().args[0];
      expect(request.endpoint).toBe('ip-manager/ip-1');
      expect(messageFor(request, 200)?.messageText).toBe('IpManager.Messages.UpdateSuccess');
    });

    it('delete should target the IP', () => {
      respondWith({ success: true });

      expect(emitted(service.delete('ip-1'))).toEqual({ success: true } as never);
      const request = client.delete.calls.mostRecent().args[0];
      expect(request.endpoint).toBe('ip-manager/ip-1');
      expect(messageFor(request, 404)?.messageText).toBe('IpManager.Messages.NotFound');
    });
  });

  describe('RequestLogManagerService', () => {
    let service: RequestLogManagerService;

    beforeEach(() => {
      service = new RequestLogManagerService(client);
    });

    it('should use the default page', () => {
      respondWith([{ id: 'log-1' }]);

      expect(emitted(service.getAll())).toEqual([{ id: 'log-1' }] as never);
      expect(client.get.calls.mostRecent().args[0].endpoint).toBe('request-log?limit=100&offset=0');
    });

    it('should apply limit and offset', () => {
      respondWith([]);

      emitted(service.getAll(10, 20));

      expect(client.get.calls.mostRecent().args[0].endpoint).toBe('request-log?limit=10&offset=20');
    });

    it('should fall back to an empty list', () => {
      respondWith(null);

      expect(emitted(service.getAll())).toEqual([]);
    });
  });

  describe('AuthApiService', () => {
    let service: AuthApiService;

    beforeEach(() => {
      service = new AuthApiService(client);
      respondWith({ success: true });
    });

    it('login should post the credentials and show an error for 401', () => {
      const credentials = { username: 'anna', password: 'secret' };

      emitted(service.login(credentials));

      const request = client.post.calls.mostRecent().args[0];
      expect(request.endpoint).toBe('auth/login');
      expect(request.requestBody).toBe(credentials);
      expect(messageFor(request, 401)).toEqual({
        statusCode: 401,
        messageText: 'Auth.Error.InvalidCredentials',
        status: 'danger'
      });
    });

    it('register should post the user data and define its messages', () => {
      const data = { username: 'anna', email: 'a@example.com', password: 'secret' };

      emitted(service.register(data));

      const request = client.post.calls.mostRecent().args[0];
      expect(request.endpoint).toBe('auth/register');
      expect(request.requestBody).toBe(data);
      expect(messageFor(request, 201)?.messageText).toBe('Auth.Register.Success');
      expect(messageFor(request, 409)?.messageText).toBe('Auth.Error.UsernameExists');
    });
  });

  describe('ConfigApiService', () => {
    let service: ConfigApiService;

    beforeEach(() => {
      service = new ConfigApiService(client);
      respondWith({ enableRegistration: true });
    });

    it('getConfig should read the config', () => {
      emitted(service.getConfig());

      expect(client.get.calls.mostRecent().args[0].endpoint).toBe('config');
    });

    it('updateConfig should put the DTO', () => {
      const dto = { enableRegistration: false };

      emitted(service.updateConfig(dto));

      const request = client.put.calls.mostRecent().args[0];
      expect(request.endpoint).toBe('config');
      expect(request.requestBody).toBe(dto);
      expect(messageFor(request, 200)?.messageText).toBe('ConfigManager.Messages.UpdateSuccess');
    });
  });

  describe('ConfigManagerService', () => {
    let api: jasmine.SpyObj<ConfigApiService>;
    let states: ConfigStatesService;
    let service: ConfigManagerService;
    const answer = (enableRegistration: boolean) => of(new HttpResponse({ body: { enableRegistration } }));

    beforeEach(() => {
      api = jasmine.createSpyObj<ConfigApiService>('ConfigApiService', ['getConfig', 'updateConfig']);
      states = new ConfigStatesService();
      service = new ConfigManagerService(api, states);
    });

    it('loadConfig should emit the config and store it', () => {
      api.getConfig.and.returnValue(answer(true));

      expect(emitted(service.loadConfig())).toEqual({ enableRegistration: true });
      expect(states.config.value).toEqual({ enableRegistration: true });
    });

    it('updateConfig should send the DTO and store the answer', () => {
      api.updateConfig.and.returnValue(answer(false));

      expect(emitted(service.updateConfig({ enableRegistration: false }))).toEqual({ enableRegistration: false });
      expect(api.updateConfig).toHaveBeenCalledOnceWith({ enableRegistration: false });
      expect(states.config.value).toEqual({ enableRegistration: false });
    });

    it('should not store anything before subscribing', () => {
      api.getConfig.and.returnValue(answer(true));

      service.loadConfig();

      expect(states.config.value).toBeNull();
    });
  });
});
