import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { AuthGuard } from './auth.guard';
import { DefaultRouteGuard } from './default-route.guard';
import { RoleGuard } from './role.guard';
import { AuthManager } from '../managers/auth-manager/auth.manager';
import { User } from '@shared/models/user.model';
import { UserRole } from '@shared/types/user-role';

describe('route guards', () => {
  let authManager: jasmine.SpyObj<AuthManager>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authManager = jasmine.createSpyObj<AuthManager>('AuthManager', ['isAuthenticated', 'getCurrentUser']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
  });

  const userWithRole = (userRole: UserRole) => new User({ userRole });

  describe('AuthGuard', () => {
    const activate = () => new AuthGuard(authManager, router)
      .canActivate({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot);

    it('should allow an authenticated user', () => {
      authManager.isAuthenticated.and.returnValue(true);

      expect(activate()).toBeTrue();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should redirect an anonymous user to the login page', () => {
      authManager.isAuthenticated.and.returnValue(false);

      expect(activate()).toBeFalse();
      expect(router.navigate).toHaveBeenCalledOnceWith(['/login']);
    });
  });

  describe('DefaultRouteGuard', () => {
    const activate = () => new DefaultRouteGuard(authManager, router).canActivate();

    it('should send a SuperAdmin to the admin logs', () => {
      authManager.getCurrentUser.and.returnValue(userWithRole(UserRole.SuperAdmin));

      expect(activate()).toBeFalse();
      expect(router.navigate).toHaveBeenCalledOnceWith(['/admin/logs']);
    });

    for (const role of [UserRole.Admin, UserRole.Moderator, UserRole.User]) {
      it(`should send ${role} to the dashboard`, () => {
        authManager.getCurrentUser.and.returnValue(userWithRole(role));

        expect(activate()).toBeFalse();
        expect(router.navigate).toHaveBeenCalledOnceWith(['/dashboard']);
      });
    }

    it('should send a missing user to the dashboard', () => {
      authManager.getCurrentUser.and.returnValue(null);

      expect(activate()).toBeFalse();
      expect(router.navigate).toHaveBeenCalledOnceWith(['/dashboard']);
    });
  });

  describe('RoleGuard', () => {
    const activate = (roles?: UserRole[]) => new RoleGuard(authManager, router)
      .canActivate({ data: { roles } } as unknown as ActivatedRouteSnapshot);

    it('should redirect a missing user to the login page', () => {
      authManager.getCurrentUser.and.returnValue(null);

      expect(activate([UserRole.Admin])).toBeFalse();
      expect(router.navigate).toHaveBeenCalledOnceWith(['/login']);
    });

    it('should allow a user with one of the required roles', () => {
      authManager.getCurrentUser.and.returnValue(userWithRole(UserRole.Admin));

      expect(activate([UserRole.SuperAdmin, UserRole.Admin])).toBeTrue();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should redirect a user without the required role to the dashboard', () => {
      authManager.getCurrentUser.and.returnValue(userWithRole(UserRole.User));

      expect(activate([UserRole.SuperAdmin])).toBeFalse();
      expect(router.navigate).toHaveBeenCalledOnceWith(['/dashboard']);
    });

    it('should allow any logged-in user when no roles are configured', () => {
      authManager.getCurrentUser.and.returnValue(userWithRole(UserRole.User));

      expect(activate()).toBeTrue();
      expect(activate([])).toBeTrue();
    });
  });
});
