import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '../../../../../shared/models/user.model';
import { UserManager } from '../user-manager/user.manager';
import { AuthApiService } from './auth-api.service';
import { RegisterRequestDto } from '../../../../../shared/dtos/register-request.dto';
import { AuthRequestDto } from '../../../../../shared/dtos/auth-request.dto';

@Injectable({
  providedIn: 'root'
})
export class AuthManager {
  public constructor(
    private authApiService: AuthApiService,
    private userManager: UserManager
  ) {}

  public authenticate(credentials: AuthRequestDto): Observable<void> {
    return new Observable(observer => {
      this.authApiService.login(credentials).subscribe({
        next: (response) => {
          if (response.body?.success && response.body?.token) {
            this.saveToken(response.body.token);
            if (response.body.user) {
              const user = new User(response.body.user);
              this.saveUser(user);
            }
            observer.next();
            observer.complete();
          } else {
            observer.error(new Error('Authentication failed'));
          }
        },
        error: (error) => {
          observer.error(error);
        }
      });
    });
  }

  public register(userData: RegisterRequestDto): Observable<void> {
    return new Observable(observer => {
      this.authApiService.register(userData).subscribe({
        next: (response) => {
          if (response.body?.success && response.body?.token) {
            observer.next();
            observer.complete();
          } else {
            observer.error(new Error('Registration failed'));
          }
        },
        error: (error) => {
          observer.error(error);
        }
      });
    });
  }

  public saveToken(token: string): void {
    localStorage.setItem('authToken', token);
  }

  public saveUser(user: User): void {
    this.userManager.setUser(user);
  }

  public getToken(): string | null {
    return localStorage.getItem('authToken');
  }

  public removeToken(): void {
    localStorage.removeItem('authToken');
    this.userManager.clearUser();
  }

  public isAuthenticated(): boolean {
    return !!this.getToken();
  }

  public getCurrentUser(): User | null {
    return this.userManager.getUser();
  }
}
