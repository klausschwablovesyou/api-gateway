import { describe, it } from '@std/testing/bdd';
import { assertEquals } from '@std/assert';
import { Authenticated, Roles, ROLES_KEY, SetMetadata } from './roles.decorator.ts';
import { UserRole } from '@shared/types/user-role.ts';

describe('roles decorators', () => {
  it('SetMetadata stores metadata on a class', () => {
    @SetMetadata('key', 'class-value')
    class Target {}

    assertEquals(Reflect.getMetadata('key', Target), 'class-value');
  });

  it('SetMetadata stores metadata on the method function, not the class', () => {
    class Target {
      @SetMetadata('key', 'method-value')
      public method(): void {}
    }

    assertEquals(Reflect.getMetadata('key', Target.prototype.method), 'method-value');
    assertEquals(Reflect.getMetadata('key', Target), undefined);
  });

  it('Roles stores the given roles under ROLES_KEY', () => {
    class Target {
      @Roles(UserRole.Admin, UserRole.Moderator)
      public method(): void {}
    }

    assertEquals(Reflect.getMetadata(ROLES_KEY, Target.prototype.method), [UserRole.Admin, UserRole.Moderator]);
  });

  it('Authenticated allows every user role', () => {
    @Authenticated()
    class Target {}

    assertEquals(
      [...Reflect.getMetadata(ROLES_KEY, Target)].sort(),
      Object.values(UserRole).sort(),
    );
  });
});
