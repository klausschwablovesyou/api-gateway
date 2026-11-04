import { HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AuthManager } from './auth.manager';
import { AuthApiService } from './auth-api.service';
import { UserManager } from '../user-manager/user.manager';
import { User } from '@shared/models/user.model';
import { AuthResponseDto } from '@shared/dtos/auth-response.dto';

describe('AuthManager', () => {
  let api: jasmine.SpyObj<AuthApiService>;
  let userManager: jasmine.SpyObj<UserManager>;
  let manager: AuthManager;

  const credentials = { username: 'anna', password: 'secret' };
  const registration = { username: 'anna', email: 'a@example.com', password: 'secret' };

  const response = (body: Partial<AuthResponseDto> | null) => of(new HttpResponse({ body: body as AuthResponseDto }));

  /** Subscribes and reports what the observable emitted. */
  function outcome(source: ReturnType<AuthManager['authenticate']>) {
    const result = { next: 0, completed: false, error: undefined as unknown };
    source.subscribe({
      next: () => result.next++,
      complete: () => (result.completed = true),
      error: error => (result.error = error)
    });
    return result;
  }

  beforeEach(() => {
    localStorage.removeItem('authToken');
    api = jasmine.createSpyObj<AuthApiService>('AuthApiService', ['login', 'register']);
    userManager = jasmine.createSpyObj<UserManager>('UserManager', ['setUser', 'getUser', 'clearUser']);
    manager = new AuthManager(api, userManager);
  });

  afterEach(() => localStorage.removeItem('authToken'));

  describe('authenticate', () => {
    it('should store the token and the user', () => {
      api.login.and.returnValue(response({ success: true, token: 'token-1', user: new User({ id: 'user-1' }) }));

      const result = outcome(manager.authenticate(credentials));

      expect(api.login).toHaveBeenCalledOnceWith(credentials);
      expect(result).toEqual({ next: 1, completed: true, error: undefined });
      expect(localStorage.getItem('authToken')).toBe('token-1');
      const stored = userManager.setUser.calls.mostRecent().args[0];
      expect(stored).toBeInstanceOf(User);
      expect(stored?.id).toBe('user-1');
    });

    it('should succeed without a user in the response', () => {
      api.login.and.returnValue(response({ success: true, token: 'token-1' }));

      expect(outcome(manager.authenticate(credentials)).completed).toBeTrue();
      expect(userManager.setUser).not.toHaveBeenCalled();
    });

    const unsuccessful: Array<[string, Partial<AuthResponseDto> | null]> = [
      ['the response has no body', null],
      ['success is false', { success: false, token: 'token-1' }],
      ['the token is missing', { success: true }],
    ];

    for (const [description, body] of unsuccessful) {
      it(`should fail and store nothing when ${description}`, () => {
        api.login.and.returnValue(response(body));

        const result = outcome(manager.authenticate(credentials));

        expect((result.error as Error).message).toBe('Authentication failed');
        expect(result.next).toBe(0);
        expect(localStorage.getItem('authToken')).toBeNull();
      });
    }

    it('should pass API errors on', () => {
      const failure = new Error('401');
      api.login.and.returnValue(throwError(() => failure));

      expect(outcome(manager.authenticate(credentials)).error).toBe(failure);
    });

    it('should not call the API before subscribing', () => {
      manager.authenticate(credentials);

      expect(api.login).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('should complete without logging the user in', () => {
      api.register.and.returnValue(response({ success: true, token: 'token-1' }));

      const result = outcome(manager.register(registration));

      expect(api.register).toHaveBeenCalledOnceWith(registration);
      expect(result).toEqual({ next: 1, completed: true, error: undefined });
      expect(localStorage.getItem('authToken')).toBeNull();
      expect(userManager.setUser).not.toHaveBeenCalled();
    });

    it('should fail on an unsuccessful response', () => {
      api.register.and.returnValue(response({ success: false }));

      expect((outcome(manager.register(registration)).error as Error).message).toBe('Registration failed');
    });

    it('should pass API errors on', () => {
      const failure = new Error('409');
      api.register.and.returnValue(throwError(() => failure));

      expect(outcome(manager.register(registration)).error).toBe(failure);
    });
  });

  describe('session helpers', () => {
    it('should report authentication based on the stored token', () => {
      expect(manager.isAuthenticated()).toBeFalse();

      manager.saveToken('token-1');

      expect(manager.getToken()).toBe('token-1');
      expect(manager.isAuthenticated()).toBeTrue();
    });

    it('should remove the token and the user', () => {
      manager.saveToken('token-1');

      manager.removeToken();

      expect(manager.getToken()).toBeNull();
      expect(userManager.clearUser).toHaveBeenCalledTimes(1);
    });

    it('should delegate saving and reading the user', () => {
      const user = new User({ id: 'user-1' });
      userManager.getUser.and.returnValue(user);

      manager.saveUser(user);

      expect(userManager.setUser).toHaveBeenCalledOnceWith(user);
      expect(manager.getCurrentUser()).toBe(user);
    });
  });
});
