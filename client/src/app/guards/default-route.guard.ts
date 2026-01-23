import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthManager } from '../managers/auth-manager/auth.manager';
import { UserRole } from '@shared/types/user-role';

@Injectable({
  providedIn: 'root'
})
export class DefaultRouteGuard implements CanActivate {
  constructor(
    private _authManager: AuthManager,
    private _router: Router
  ) {}

  public canActivate(): boolean {
    const currentUser = this._authManager.getCurrentUser();

    if (currentUser?.userRole === UserRole.SuperAdmin) {
      this._router.navigate(['/admin/logs']);
      return false;
    }

    this._router.navigate(['/dashboard']);
    return false;
  }
}
