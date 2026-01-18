import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NbCardModule, NbInputModule, NbButtonModule, NbLayoutModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { AuthManager } from '../../managers/auth-manager/auth.manager';
import { PasswordValidator } from '../../validators/password.validator';

@Component({
  standalone: true,
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NbLayoutModule,
    NbCardModule,
    NbInputModule,
    NbButtonModule,
    NbIconModule,
    TranslateModule
  ]
})
export class RegisterComponent {
  public registerForm: FormGroup;

  protected readonly pwValidationMessages: Record<string, string> = {
    required: 'PasswordRequired',
    minlength: 'PasswordTooShort',
    needsLowercase: 'PasswordNeedsLowercase',
    needsUppercase: 'PasswordNeedsUppercase',
    needsNumber: 'PasswordNeedsNumber',
    needsSpecialChar: 'PasswordNeedsSpecialChar'
  };

  constructor(
    private _formBuilder: FormBuilder,
    private _router: Router,
    private _authManager: AuthManager
  ) {
    this.registerForm = this._formBuilder.group({
      username: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, PasswordValidator.strong]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  public onSubmit(): void {
    if (this.registerForm.valid) {
      const { username, email, password } = this.registerForm.value;
      this._authManager.register({
        username, email, password
      }).subscribe({
        next: () => {
          this._router.navigate(['/login']);
        },
        error: (error: Error) => {
          console.error('Registration failed:', error);
        }
      });
    }
  }

  public navigateToLogin(): void {
    this._router.navigate(['/login']);
  }

  private passwordMatchValidator(form: FormGroup): { [key: string]: boolean } | null {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      return { passwordMismatch: true };
    }

    return null;
  }
}
