import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RegisterComponent } from './register.component';
import { AuthManager } from '../../managers/auth-manager/auth.manager';

describe('RegisterComponent', () => {
  const VALID = { username: 'anna', email: 'a@example.com', password: 'Abc1!x', confirmPassword: 'Abc1!x' };

  let router: jasmine.SpyObj<Router>;
  let authManager: jasmine.SpyObj<AuthManager>;
  let component: RegisterComponent;

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    authManager = jasmine.createSpyObj<AuthManager>('AuthManager', ['register']);
    component = new RegisterComponent(new FormBuilder(), router, authManager);
  });

  describe('form', () => {
    it('should accept valid data', () => {
      component.registerForm.setValue(VALID);

      expect(component.registerForm.valid).toBeTrue();
    });

    it('should reject an invalid email', () => {
      component.registerForm.setValue({ ...VALID, email: 'not-an-email' });

      expect(component.registerForm.get('email')?.hasError('email')).toBeTrue();
    });

    it('should apply the password strength rules', () => {
      component.registerForm.setValue({ ...VALID, password: 'abc', confirmPassword: 'abc' });

      const password = component.registerForm.get('password');
      expect(password?.hasError('minlength')).toBeTrue();
      expect(password?.hasError('needsUppercase')).toBeTrue();
    });

    it('should report mismatching passwords on the form', () => {
      component.registerForm.setValue({ ...VALID, confirmPassword: 'Different1!' });

      expect(component.registerForm.hasError('passwordMismatch')).toBeTrue();
      expect(component.registerForm.valid).toBeFalse();
    });

    it('should not report a mismatch for equal passwords', () => {
      component.registerForm.setValue(VALID);

      expect(component.registerForm.hasError('passwordMismatch')).toBeFalse();
    });
  });

  describe('onSubmit', () => {
    it('should not register with an invalid form', () => {
      component.onSubmit();

      expect(authManager.register).not.toHaveBeenCalled();
    });

    it('should register without the confirmation field and go to the login page', () => {
      authManager.register.and.returnValue(of(undefined));
      component.registerForm.setValue(VALID);

      component.onSubmit();

      expect(authManager.register).toHaveBeenCalledOnceWith({
        username: 'anna',
        email: 'a@example.com',
        password: 'Abc1!x'
      });
      expect(router.navigate).toHaveBeenCalledOnceWith(['/login']);
    });

    it('should stay on the page when registration fails', () => {
      spyOn(console, 'error');
      authManager.register.and.returnValue(throwError(() => new Error('409')));
      component.registerForm.setValue(VALID);

      component.onSubmit();

      expect(router.navigate).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  it('should navigate to the login page', () => {
    component.navigateToLogin();

    expect(router.navigate).toHaveBeenCalledOnceWith(['/login']);
  });
});
