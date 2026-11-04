import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';
import { UserManager } from '../managers/user-manager/user.manager';

@Injectable()
export class JwtInterceptor implements HttpInterceptor {

  // AuthManager cannot be injected here: it depends on HttpClient, which depends on this interceptor.
  public constructor(
    private readonly _userManager: UserManager,
    private readonly _router: Router
  ) {}

  public intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Get the auth token from localStorage
    const token = localStorage.getItem('authToken');
    
    // If we have a token and the request is to our API, add the Authorization header
    if (token && request.url.startsWith('/api/')) {
      const authRequest = request.clone({
        headers: request.headers.set('Authorization', `Bearer ${token}`)
      });
      return next.handle(authRequest).pipe(
        catchError((error: unknown) => {
          // The stored token was rejected (e.g. expired), so the session is over.
          if (error instanceof HttpErrorResponse && error.status === 401) {
            localStorage.removeItem('authToken');
            this._userManager.clearUser();
            this._router.navigate(['/login']);
          }
          return throwError(() => error);
        })
      );
    }
    
    // For all other requests, proceed without modification
    return next.handle(request);
  }
}