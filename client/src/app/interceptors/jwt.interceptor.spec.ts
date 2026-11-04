import { TestBed } from '@angular/core/testing';
import {
  HTTP_INTERCEPTORS,
  HttpClient,
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpRequest,
  provideHttpClient,
  withInterceptorsFromDi
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { JwtInterceptor } from './jwt.interceptor';
import { UserManager } from '../managers/user-manager/user.manager';

describe('JwtInterceptor', () => {
  let handled: HttpRequest<unknown>[];
  let next: HttpHandler;
  let userManager: jasmine.SpyObj<UserManager>;
  let router: jasmine.SpyObj<Router>;
  let interceptor: JwtInterceptor;

  beforeEach(() => {
    handled = [];
    next = {
      handle: (request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> => {
        handled.push(request);
        return of();
      }
    };
    userManager = jasmine.createSpyObj<UserManager>('UserManager', ['clearUser']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    interceptor = new JwtInterceptor(userManager, router);
    localStorage.removeItem('authToken');
  });

  afterEach(() => localStorage.removeItem('authToken'));

  it('should add the token to API requests', () => {
    localStorage.setItem('authToken', 'token-1');

    interceptor.intercept(new HttpRequest('GET', '/api/apis'), next);

    expect(handled[0].headers.get('Authorization')).toBe('Bearer token-1');
  });

  it('should keep the original headers and not mutate the original request', () => {
    localStorage.setItem('authToken', 'token-1');
    const request = new HttpRequest('POST', '/api/apis', {}).clone({ setHeaders: { 'X-Test': 'yes' } });

    interceptor.intercept(request, next);

    expect(handled[0].headers.get('X-Test')).toBe('yes');
    expect(request.headers.has('Authorization')).toBeFalse();
  });

  it('should not send the token to other hosts or paths', () => {
    localStorage.setItem('authToken', 'token-1');

    for (const url of ['https://evil.example.com/api/x', '/assets/i18n/en.json', 'api/x']) {
      interceptor.intercept(new HttpRequest('GET', url), next);
    }

    expect(handled.every(request => !request.headers.has('Authorization'))).toBeTrue();
  });

  it('should pass the request through unchanged without a token', () => {
    const request = new HttpRequest('GET', '/api/apis');

    interceptor.intercept(request, next);

    expect(handled[0]).toBe(request);
  });

  describe('rejected token', () => {
    const failWith = (status: number, url = '/api/apis') => {
      let thrown: unknown;
      const failure = new HttpErrorResponse({ status });
      const failing: HttpHandler = { handle: () => throwError(() => failure) };

      interceptor.intercept(new HttpRequest('GET', url), failing).subscribe({ error: error => (thrown = error) });

      expect(thrown).toBe(failure);
    };

    it('should end the session and go to the login page on 401', () => {
      localStorage.setItem('authToken', 'expired');

      failWith(401);

      expect(localStorage.getItem('authToken')).toBeNull();
      expect(userManager.clearUser).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledOnceWith(['/login']);
    });

    it('should keep the session on other errors', () => {
      localStorage.setItem('authToken', 'token-1');

      failWith(403);
      failWith(500);

      expect(localStorage.getItem('authToken')).toBe('token-1');
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should ignore a 401 from another host', () => {
      localStorage.setItem('authToken', 'token-1');

      failWith(401, 'https://other.example.com/api/x');

      expect(localStorage.getItem('authToken')).toBe('token-1');
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should ignore a 401 without a stored token, such as a failed login', () => {
      failWith(401, '/api/auth/login');

      expect(userManager.clearUser).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  it('should resolve through real DI without a circular dependency', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true }
      ]
    });
    localStorage.setItem('authToken', 'token-1');

    TestBed.inject(HttpClient).get('/api/apis').subscribe();

    const call = TestBed.inject(HttpTestingController).expectOne('/api/apis');
    expect(call.request.headers.get('Authorization')).toBe('Bearer token-1');
    call.flush({});
  });
});
