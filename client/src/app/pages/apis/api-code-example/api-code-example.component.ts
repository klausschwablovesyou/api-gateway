import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbSelectModule, NbDialogRef } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { Api } from '@shared/models/api.model';
import { CodePyComponent } from './code-py/code-py.component';
import { CodeRsComponent } from './code-rs/code-rs.component';

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
    NbSelectModule,
    TranslateModule,
    CodePyComponent,
    CodeRsComponent
  ]
})
export class ApiCodeExampleComponent {
  public api!: Api;
  public gatewayUrl = `${window.location.origin}/api/gateway`;
  public selectedLanguage: 'python' | 'rust' = 'python';

  @ViewChild(CodePyComponent) private _pyComp?: CodePyComponent;
  @ViewChild(CodeRsComponent) private _rsComp?: CodeRsComponent;

  constructor(
    private readonly _dialogRef: NbDialogRef<ApiCodeExampleComponent>
  ) {}

  public async copyToClipboard(): Promise<void> {
    const code = this.selectedLanguage === 'python'
      ? this._pyComp?.getCode()
      : this._rsComp?.getCode();
    if (code) {
      await navigator.clipboard.writeText(code);
    }
  }

  public onClose(): void {
    this._dialogRef.close();
  }
}
