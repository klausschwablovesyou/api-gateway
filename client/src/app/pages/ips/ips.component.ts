import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbIconModule, NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IpManagerService } from '@app/managers/ip-manager/ip-manager.service';
import { Ip } from '@shared/models/ip.model';
import { IpSyncResponseDto } from '@shared/dtos/ip-sync-response.dto';
import { IpEditorComponent } from './ip-editor/ip-editor.component';
import { ConfirmDialogComponent } from '@app/components/confirm-dialog/confirm-dialog.component';

@Component({
  standalone: true,
  selector: 'app-ips',
  templateUrl: './ips.component.html',
  styleUrls: ['./ips.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    NbCardModule,
    NbButtonModule,
    NbIconModule,
    TranslateModule
  ]
})
export class IpsComponent implements OnInit {
  public ips: Ip[] = [];
  public syncing = false;

  constructor(
    private readonly _ipManagerService: IpManagerService,
    private readonly _cdr: ChangeDetectorRef,
    private readonly _dialogService: NbDialogService,
    private readonly _translateService: TranslateService,
    private readonly _toastrService: NbToastrService
  ) {}

  public ngOnInit(): void {
    this._loadIps();
  }

  public onSync(): void {
    this.syncing = true;
    this._ipManagerService.sync().subscribe({
      next: (result) => {
        this.syncing = false;
        this._showSyncResult(result);
        this._cdr.markForCheck();
      },
      error: () => {
        this.syncing = false;
        this._cdr.markForCheck();
      }
    });
  }

  public onAdd(): void {
    this._dialogService.open(IpEditorComponent).onClose.subscribe((result) => {
      if (result) {
        this._ipManagerService.create(result).subscribe({
          next: () => this._loadIps()
        });
      }
    });
  }

  public onEdit(ip: Ip): void {
    const dialogRef = this._dialogService.open(IpEditorComponent);
    dialogRef.componentRef.instance.ip = ip;
    dialogRef.onClose.subscribe((result) => {
      if (result) {
        this._ipManagerService.update(ip.id, result).subscribe({
          next: () => this._loadIps()
        });
      }
    });
  }

  public onDelete(ip: Ip): void {
    const dialogRef = this._dialogService.open(ConfirmDialogComponent);
    dialogRef.componentRef.instance.title = this._translateService.instant('Common.Confirm');
    dialogRef.componentRef.instance.message = this._translateService.instant('IpManager.ConfirmDelete');
    dialogRef.onClose.subscribe((confirmed) => {
      if (confirmed) {
        this._ipManagerService.delete(ip.id).subscribe({
          next: () => this._loadIps()
        });
      }
    });
  }

  private _showSyncResult(result: IpSyncResponseDto): void {
    const messageKey = result.failed > 0 ? 'IpManager.Messages.SyncPartial' : 'IpManager.Messages.SyncSuccess';
    const message = this._translateService.instant(messageKey, {
      succeeded: result.succeeded,
      failed: result.failed,
      total: result.total,
      networkInterface: result.networkInterface
    });

    this._toastrService.show(message, '', { status: result.failed > 0 ? 'danger' : 'success' });
  }

  private _loadIps(): void {
    this._ipManagerService.getAll().subscribe({
      next: (ips) => {
        this.ips = ips;
        this._cdr.markForCheck();
      }
    });
  }
}
