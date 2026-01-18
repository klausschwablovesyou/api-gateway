import { Injectable } from '@angular/core';
import { User } from '../../../../../shared/models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserManager {
  private currentUser: User | null = null;

  public constructor() {}

  public setUser(user: User | null): void {
    this.currentUser = user;
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('currentUser');
    }
  }

  public getUser(): User | null {
    if (!this.currentUser) {
      const userString = localStorage.getItem('currentUser');
      this.currentUser = userString ? new User(JSON.parse(userString)) : null;
    }
    return this.currentUser;
  }

  public clearUser(): void {
    this.currentUser = null;
    localStorage.removeItem('currentUser');
  }
}
