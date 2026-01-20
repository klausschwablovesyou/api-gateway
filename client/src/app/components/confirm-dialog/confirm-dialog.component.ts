import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbDialogRef } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  standalone: true,
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    NbCardModule,
    NbButtonModule,
    TranslateModule
  ]
})
export class ConfirmDialogComponent {
  public title = '';
  public message = '';

  constructor(
    private readonly _dialogRef: NbDialogRef<ConfirmDialogComponent>
  ) {}

  public onConfirm(): void {
    this._dialogRef.close(true);
  }

  public onCancel(): void {
    this._dialogRef.close(false);
  }
}
