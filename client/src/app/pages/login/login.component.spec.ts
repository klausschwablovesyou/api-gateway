import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthManager } from '../../managers/auth-manager/auth.manager';
import { ConfigStatesService } from '../../managers/config-manager/config-states.service';

describe('LoginComponent', () => {
  let router: jasmine.SpyObj<Router>;
  let authManager: jasmine.SpyObj<AuthManager>;
  let component: LoginComponent;

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    authManager = jasmine.createSpyObj<AuthManager>('AuthManager', ['authenticate']);
    component = new LoginComponent(new FormBuilder(), router, authManager, new ConfigStatesService());
  });

  describe('form', () => {
    it('should start invalid', () => {
      expect(component.loginForm.valid).toBeFalse();
    });

    it('should require a password of at least 6 characters', () => {
      component.loginForm.setValue({ username: 'anna', password: '12345' });
      expect(component.loginForm.get('password')?.hasError('minlength')).toBeTrue();

      component.loginForm.setValue({ username: 'anna', password: '123456' });
      expect(component.loginForm.valid).toBeTrue();
    });

    it('should require a username', () => {
      component.loginForm.setValue({ username: '', password: '123456' });

      expect(component.loginForm.get('username')?.hasError('required')).toBeTrue();
    });
  });

  describe('onSubmit', () => {
    it('should not authenticate with an invalid form', () => {
      component.onSubmit();

      expect(authManager.authenticate).not.toHaveBeenCalled();
    });

    it('should authenticate and go to the dashboard', () => {
      authManager.authenticate.and.returnValue(of(undefined));
      component.loginForm.setValue({ username: 'anna', password: 'secret1' });

      component.onSubmit();

      expect(authManager.authenticate).toHaveBeenCalledOnceWith({ username: 'anna', password: 'secret1' });
      expect(router.navigate).toHaveBeenCalledOnceWith(['/dashboard']);
    });

    it('should stay on the page when authentication fails', () => {
      spyOn(console, 'error');
      authManager.authenticate.and.returnValue(throwError(() => new Error('401')));
      component.loginForm.setValue({ username: 'anna', password: 'secret1' });

      component.onSubmit();

      expect(router.navigate).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  it('should navigate to the registration page', () => {
    component.navigateToRegister();

    expect(router.navigate).toHaveBeenCalledOnceWith(['/register']);
  });
});
