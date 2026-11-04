import { FormControl } from '@angular/forms';
import { PasswordValidator } from './password.validator';

describe('PasswordValidator.strong', () => {
  const validate = (value: unknown) => PasswordValidator.strong(new FormControl(value));

  it('should leave empty values to Validators.required', () => {
    expect(validate('')).toBeNull();
    expect(validate(null)).toBeNull();
  });

  it('should accept a password that meets every rule', () => {
    expect(validate('Abc1!x')).toBeNull();
  });

  const cases: Array<[string, string, string]> = [
    ['is shorter than 6 characters', 'Ab1!x', 'minlength'],
    ['has no lowercase letter', 'ABC1!X', 'needsLowercase'],
    ['has no uppercase letter', 'abc1!x', 'needsUppercase'],
    ['has no number', 'Abcd!x', 'needsNumber'],
    ['has no special character', 'Abc12x', 'needsSpecialChar'],
  ];

  for (const [description, password, error] of cases) {
    it(`should report only ${error} when the password ${description}`, () => {
      expect(validate(password)).toEqual({ [error]: true });
    });
  }

  it('should report every failed rule together', () => {
    expect(validate(' ')).toEqual({
      minlength: true,
      needsLowercase: true,
      needsUppercase: true,
      needsNumber: true,
      needsSpecialChar: true,
    });
  });
});
