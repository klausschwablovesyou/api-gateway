import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbIconModule, NbDialogService, NbTooltipModule } from '@nebular/theme';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiManagerService } from '@app/managers/api-manager/api-manager.service';
import { Api } from '@shared/models/api.model';
import { ApiEditorComponent } from './api-editor/api-editor.component';
import { ApiCodeExampleComponent } from './api-code-example/api-code-example.component';
import { ConfirmDialogComponent } from '@app/components/confirm-dialog/confirm-dialog.component';

@Component({
  standalone: true,
  selector: 'app-apis',
  templateUrl: './apis.component.html',
  styleUrls: ['./apis.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    NbCardModule,
    NbButtonModule,
    NbIconModule,
    NbTooltipModule,
    TranslateModule
  ]
})
export class ApisComponent implements OnInit {
  public apis: Api[] = [];

  constructor(
    private readonly _apiManagerService: ApiManagerService,
    private readonly _cdr: ChangeDetectorRef,
    private readonly _dialogService: NbDialogService,
    private readonly _translateService: TranslateService
  ) {}

  public ngOnInit(): void {
    this._loadApis();
  }

  public onAdd(): void {
    this._dialogService.open(ApiEditorComponent).onClose.subscribe((result) => {
      if (result) {
        this._apiManagerService.create(result).subscribe({
          next: (createdApi) => {
            this.apis = [createdApi, ...this.apis];
            this._cdr.markForCheck();
          }
        });
      }
    });
  }

  public onEdit(api: Api): void {
    const dialogRef = this._dialogService.open(ApiEditorComponent);
    dialogRef.componentRef.instance.api = api;
    dialogRef.onClose.subscribe((result) => {
      if (result) {
        this._apiManagerService.update(api.id, result).subscribe({
          next: (updatedApi) => {
            const index = this.apis.findIndex(a => a.id === api.id);
            if (index !== -1) {
              this.apis[index] = updatedApi;
              this.apis = [...this.apis];
              this._cdr.markForCheck();
            }
          }
        });
      }
    });
  }

  public async copyToClipboard(value: string): Promise<void> {
    await navigator.clipboard.writeText(value);
  }

  public onShowCodeExample(api: Api): void {
    const dialogRef = this._dialogService.open(ApiCodeExampleComponent);
    dialogRef.componentRef.instance.api = api;
  }

  public onDelete(api: Api): void {
    const dialogRef = this._dialogService.open(ConfirmDialogComponent);
    dialogRef.componentRef.instance.title = this._translateService.instant('Common.Confirm');
    dialogRef.componentRef.instance.message = this._translateService.instant('ApiManager.ConfirmDelete');
    dialogRef.onClose.subscribe((confirmed) => {
      if (confirmed) {
        this._apiManagerService.delete(api.id).subscribe({
          next: () => this._loadApis()
        });
      }
    });
  }

  private _loadApis(): void {
    this._apiManagerService.getAll().subscribe({
      next: (apis) => {
        this.apis = apis;
        this._cdr.markForCheck();
      }
    });
  }
}
