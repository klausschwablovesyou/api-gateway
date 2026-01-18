import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthManager } from '../managers/auth-manager/auth.manager';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private _authManager: AuthManager,
    private _router: Router
  ) {}

  public canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    if (this._authManager.isAuthenticated()) {
      return true;
    }

    this._router.navigate(['/login']);
    return false;
  }
}
