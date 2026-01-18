import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NbCardModule, NbInputModule, NbButtonModule, NbLayoutModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { AuthManager } from '../../managers/auth-manager/auth.manager';
import { BotManager } from '../../managers/bot-manager/bot.manager';

@Component({
  standalone: true,
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
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
export class LoginComponent {
  public loginForm: FormGroup;

  constructor(
    private _formBuilder: FormBuilder,
    private _router: Router,
    private _authManager: AuthManager,
    private _botManager: BotManager
  ) {
    this.loginForm = this._formBuilder.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  public onSubmit(): void {
    if (this.loginForm.valid) {
      const { username, password } = this.loginForm.value;
      this._authManager.authenticate({
        username, password
      }).subscribe({
        next: () => {
          this._checkBotSettingsAndNavigate();
        },
        error: (error: Error) => {
          console.error('Login failed:', error);
        }
      });
    }
  }

  private _checkBotSettingsAndNavigate(): void {
    this._botManager.getSettings().subscribe({
      next: (settings) => {
        if (settings?.telegramApiId && settings?.telegramApiHash) {
          this._router.navigate(['/dashboard']);
        } else {
          this._router.navigate(['/bot']);
        }
      },
      error: () => {
        // No settings found, redirect to bot settings page
        this._router.navigate(['/bot']);
      }
    });
  }

  public navigateToRegister(): void {
    this._router.navigate(['/register']);
  }
}
