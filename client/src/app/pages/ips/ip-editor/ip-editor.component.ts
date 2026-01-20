import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NbCardModule, NbButtonModule, NbInputModule, NbDialogRef } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { Ip } from '@shared/models/ip.model';
import { IP_PATTERN } from '@app/config/patterns';

@Component({
  standalone: true,
  selector: 'app-ip-editor',
  templateUrl: './ip-editor.component.html',
  styleUrls: ['./ip-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NbCardModule,
    NbButtonModule,
    NbInputModule,
    TranslateModule
  ]
})
export class IpEditorComponent implements OnInit {
  public form!: FormGroup;
  public ip: Ip | null = null;

  constructor(
    private readonly _fb: FormBuilder,
    private readonly _dialogRef: NbDialogRef<IpEditorComponent>
  ) {}

  public ngOnInit(): void {
    this.form = this._fb.group({
      ip: [this.ip?.ip || '', [Validators.required, Validators.pattern(IP_PATTERN)]]
    });
  }

  public get isEditMode(): boolean {
    return !!this.ip;
  }

  public onSave(): void {
    if (this.form.valid) {
      this._dialogRef.close(this.form.value);
    }
  }

  public onCancel(): void {
    this._dialogRef.close();
  }
}
