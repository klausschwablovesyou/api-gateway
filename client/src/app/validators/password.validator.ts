import { AbstractControl, ValidationErrors } from '@angular/forms';

export class PasswordValidator {
  static strong(control: AbstractControl): ValidationErrors | null {
    const value = control.value;

    if (!value) {
      return null;
    }

    const errors: ValidationErrors = {};

    if (value.length < 6) {
      errors['minlength'] = true;
    }

    if (!/[a-z]/.test(value)) {
      errors['needsLowercase'] = true;
    }

    if (!/[A-Z]/.test(value)) {
      errors['needsUppercase'] = true;
    }

    if (!/[0-9]/.test(value)) {
      errors['needsNumber'] = true;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) {
      errors['needsSpecialChar'] = true;
    }

    return Object.keys(errors).length > 0 ? errors : null;
  }
}
