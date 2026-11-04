import { beforeEach, describe, it } from '@std/testing/bdd';
import { assertEquals, assertNotEquals, assertStringIncludes } from '@std/assert';
import { PasswordService } from './password.service.ts';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  describe('hashPassword / verifyPassword', () => {
    it('produces a salted bcrypt hash, not the plain password', async () => {
      const first = await service.hashPassword('Str0ng!pass');
      const second = await service.hashPassword('Str0ng!pass');

      assertStringIncludes(first, '$2');
      assertNotEquals(first, 'Str0ng!pass');
      assertNotEquals(first, second);
    });

    it('verifies the right password and rejects the wrong one', async () => {
      const hash = await service.hashPassword('Str0ng!pass');

      assertEquals(await service.verifyPassword('Str0ng!pass', hash), true);
      assertEquals(await service.verifyPassword('wrong', hash), false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('accepts a password that meets every rule', () => {
      assertEquals(service.validatePasswordStrength('Abc1!x'), { isValid: true, errors: [] });
    });

    const cases: Array<[string, string, string]> = [
      ['shorter than 6 characters', 'Ab1!x', 'Auth.Validation.PasswordTooShort'],
      ['missing a lowercase letter', 'ABC1!X', 'Auth.Validation.PasswordNeedsLowercase'],
      ['missing an uppercase letter', 'abc1!x', 'Auth.Validation.PasswordNeedsUppercase'],
      ['missing a number', 'Abcd!x', 'Auth.Validation.PasswordNeedsNumber'],
      ['missing a special character', 'Abc12x', 'Auth.Validation.PasswordNeedsSpecialChar'],
    ];

    for (const [description, password, expectedError] of cases) {
      it(`reports exactly one error when ${description}`, () => {
        assertEquals(service.validatePasswordStrength(password), { isValid: false, errors: [expectedError] });
      });
    }

    it('reports every rule for an empty password', () => {
      assertEquals(service.validatePasswordStrength('').errors, [
        'Auth.Validation.PasswordTooShort',
        'Auth.Validation.PasswordNeedsLowercase',
        'Auth.Validation.PasswordNeedsUppercase',
        'Auth.Validation.PasswordNeedsNumber',
        'Auth.Validation.PasswordNeedsSpecialChar',
      ]);
    });
  });
});
