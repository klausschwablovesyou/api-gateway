import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthManager } from '../managers/auth-manager/auth.manager';
import { UserRole } from '@shared/types/user-role';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  constructor(
    private _authManager: AuthManager,
    private _router: Router
  ) {}

  public canActivate(route: ActivatedRouteSnapshot): boolean {
    const requiredRoles = route.data['roles'] as UserRole[];
    const currentUser = this._authManager.getCurrentUser();

    if (!currentUser) {
      this._router.navigate(['/login']);
      return false;
    }

    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(currentUser.userRole)) {
        this._router.navigate(['/dashboard']);
        return false;
      }
    }

    return true;
  }
}
