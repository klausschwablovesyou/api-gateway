import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbToggleModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { ConfigManagerService } from '@app/managers/config-manager/config-manager.service';
import { ConfigStatesService } from '@app/managers/config-manager/config-states.service';

@Component({
  standalone: true,
  selector: 'app-config',
  templateUrl: './config.component.html',
  styleUrls: ['./config.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    NbCardModule,
    NbToggleModule,
    TranslateModule
  ]
})
export class ConfigComponent {
  constructor(
    private readonly _configManagerService: ConfigManagerService,
    public configStatesService: ConfigStatesService
  ) {}

  public onEnableRegistrationChange(enabled: boolean): void {
    this._configManagerService.updateConfig({ enableRegistration: enabled }).subscribe();
  }
}
