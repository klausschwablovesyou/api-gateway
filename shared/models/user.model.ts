import { UserRole } from '@shared/types/user-role';

export class User {
  public id!: string;
  public username!: string;
  public email!: string;
  public password!: string;
  public userRole!: UserRole;
  public createdAt!: Date;
  public updatedAt!: Date;

  public constructor(private init?: Partial<User>) {
    Object.assign(this, init);
  }

  public hasRole(role: UserRole): boolean {
    return this.userRole === role;
  }

  public hasAdminPrivileges(): boolean {
    return this.userRole === UserRole.SuperAdmin || this.userRole === UserRole.Admin;
  }

  public isSuperAdmin(): boolean {
    return this.userRole === UserRole.SuperAdmin;
  }
}