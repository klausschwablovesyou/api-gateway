import { Injectable } from '@danet/core';
import * as bcrypt from 'bcrypt';
import { PasswordValidationResult } from '@backend/shared/types/password-validation-result.ts';

@Injectable()
export class PasswordService {
  private readonly _minLength = 6;
  private readonly _saltRounds = 10;

  public async hashPassword(plainPassword: string): Promise<string> {
    const salt = await bcrypt.genSalt(this._saltRounds);
    return await bcrypt.hash(plainPassword, salt);
  }

  public async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  public validatePasswordStrength(password: string): PasswordValidationResult {
    const errors: string[] = [];

    if (!password || password.length < this._minLength) {
      errors.push('Auth.Validation.PasswordTooShort');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Auth.Validation.PasswordNeedsLowercase');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Auth.Validation.PasswordNeedsUppercase');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Auth.Validation.PasswordNeedsNumber');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Auth.Validation.PasswordNeedsSpecialChar');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
