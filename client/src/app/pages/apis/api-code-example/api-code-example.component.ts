import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbDialogRef } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { Api } from '@shared/models/api.model';

@Component({
  standalone: true,
  selector: 'app-api-code-example',
  templateUrl: './api-code-example.component.html',
  styleUrls: ['./api-code-example.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    NbCardModule,
    NbButtonModule,
    TranslateModule
  ]
})
export class ApiCodeExampleComponent {
  public api!: Api;
  public gatewayUrl = `${window.location.origin}/api/gateway`;

  constructor(
    private readonly _dialogRef: NbDialogRef<ApiCodeExampleComponent>
  ) {}

  public async copyToClipboard(codeElement: HTMLElement): Promise<void> {
    await navigator.clipboard.writeText(codeElement.innerText);
  }

  public onClose(): void {
    this._dialogRef.close();
  }
}
