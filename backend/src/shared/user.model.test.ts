import { describe, it } from '@std/testing/bdd';
import { assertEquals } from '@std/assert';
import { User } from '@shared/models/user.model.ts';
import { UserRole } from '@shared/types/user-role.ts';

describe('User model', () => {
  it('copies the initial values', () => {
    const user = new User({ id: 'user-1', username: 'anna', userRole: UserRole.User });

    assertEquals(user.id, 'user-1');
    assertEquals(user.username, 'anna');
  });

  it('hasRole compares the exact role', () => {
    const user = new User({ userRole: UserRole.Moderator });

    assertEquals(user.hasRole(UserRole.Moderator), true);
    assertEquals(user.hasRole(UserRole.Admin), false);
  });

  const privileges: Array<[UserRole, boolean, boolean]> = [
    [UserRole.SuperAdmin, true, true],
    [UserRole.Admin, true, false],
    [UserRole.Moderator, false, false],
    [UserRole.User, false, false],
  ];

  for (const [role, admin, superAdmin] of privileges) {
    it(`${role}: hasAdminPrivileges=${admin}, isSuperAdmin=${superAdmin}`, () => {
      const user = new User({ userRole: role });

      assertEquals(user.hasAdminPrivileges(), admin);
      assertEquals(user.isSuperAdmin(), superAdmin);
    });
  }
});
