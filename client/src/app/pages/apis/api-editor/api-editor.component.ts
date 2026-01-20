import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NbCardModule, NbButtonModule, NbInputModule, NbSelectModule, NbDialogRef } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { Api } from '@shared/models/api.model';
import { HttpMethod } from '@shared/types/http-method';
import { RequestLimitUnit } from '@shared/types/request-limit-unit';
import { URL_PATTERN } from '@app/config/patterns';

@Component({
  standalone: true,
  selector: 'app-api-editor',
  templateUrl: './api-editor.component.html',
  styleUrls: ['./api-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NbCardModule,
    NbButtonModule,
    NbInputModule,
    NbSelectModule,
    TranslateModule
  ]
})
export class ApiEditorComponent implements OnInit {
  public form!: FormGroup;
  public api: Api | null = null;
  public httpMethods = Object.values(HttpMethod);
  public requestLimitUnits = Object.values(RequestLimitUnit);

  constructor(
    private readonly _fb: FormBuilder,
    private readonly _dialogRef: NbDialogRef<ApiEditorComponent>,
    private readonly _cdr: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
    this.form = this._fb.group({
      name: [this.api?.name || '', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      apiUrl: [this.api?.apiUrl || '', [Validators.required, Validators.pattern(URL_PATTERN)]],
      method: [this.api?.method || HttpMethod.GET, [Validators.required]],
      requestLimit: [this.api?.requestLimit || 100, [Validators.required, Validators.min(1), Validators.max(1000000)]],
      requestLimitUnit: [this.api?.requestLimitUnit || RequestLimitUnit.Minute, [Validators.required]]
    });
  }

  public get isEditMode(): boolean {
    return !!this.api;
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
