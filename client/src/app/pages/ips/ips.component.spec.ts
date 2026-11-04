import { ChangeDetectorRef } from '@angular/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';
import { IpsComponent } from './ips.component';
import { IpEditorComponent } from './ip-editor/ip-editor.component';
import { ConfirmDialogComponent } from '@app/components/confirm-dialog/confirm-dialog.component';
import { IpManagerService } from '@app/managers/ip-manager/ip-manager.service';
import { IpSyncResponseDto } from '@shared/dtos/ip-sync-response.dto';
import { Ip } from '@shared/models/ip.model';

describe('IpsComponent', () => {
  const ip = { id: 'ip-1', ip: '1.1.1.1' } as Ip;

  let manager: jasmine.SpyObj<IpManagerService>;
  let cdr: jasmine.SpyObj<ChangeDetectorRef>;
  let dialogs: jasmine.SpyObj<NbDialogService>;
  let translate: jasmine.SpyObj<TranslateService>;
  let toastr: jasmine.SpyObj<NbToastrService>;
  let dialogClose: Subject<unknown>;
  let dialogInstance: Record<string, unknown>;
  let component: IpsComponent;

  const summary = (failed: number): IpSyncResponseDto => ({
    networkInterface: 'ens3',
    total: 2,
    succeeded: 2 - failed,
    failed,
    results: []
  });

  beforeEach(() => {
    manager = jasmine.createSpyObj<IpManagerService>('IpManagerService', ['getAll', 'sync', 'create', 'update', 'delete']);
    manager.getAll.and.returnValue(of([ip]));
    cdr = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck']);
    translate = jasmine.createSpyObj<TranslateService>('TranslateService', ['instant']);
    translate.instant.and.callFake((key: string | string[]) => `translated:${key}`);
    toastr = jasmine.createSpyObj<NbToastrService>('NbToastrService', ['show']);

    dialogClose = new Subject();
    dialogInstance = {};
    dialogs = jasmine.createSpyObj<NbDialogService>('NbDialogService', ['open']);
    dialogs.open.and.returnValue({ onClose: dialogClose, componentRef: { instance: dialogInstance } } as never);

    component = new IpsComponent(manager, cdr, dialogs, translate, toastr);
  });

  it('should load the IPs on init', () => {
    component.ngOnInit();

    expect(component.ips).toEqual([ip]);
    expect(cdr.markForCheck).toHaveBeenCalled();
  });

  describe('onSync', () => {
    it('should be syncing until the response arrives', () => {
      const pending = new Subject<IpSyncResponseDto>();
      manager.sync.and.returnValue(pending);

      component.onSync();
      expect(component.syncing).toBeTrue();

      pending.next(summary(0));
      expect(component.syncing).toBeFalse();
      expect(cdr.markForCheck).toHaveBeenCalled();
    });

    it('should show a success toast with the summary', () => {
      manager.sync.and.returnValue(of(summary(0)));

      component.onSync();

      expect(translate.instant).toHaveBeenCalledOnceWith('IpManager.Messages.SyncSuccess', {
        succeeded: 2,
        failed: 0,
        total: 2,
        networkInterface: 'ens3'
      });
      expect(toastr.show).toHaveBeenCalledOnceWith('translated:IpManager.Messages.SyncSuccess', '', { status: 'success' });
    });

    it('should show a danger toast when an IP failed', () => {
      manager.sync.and.returnValue(of(summary(1)));

      component.onSync();

      expect(toastr.show).toHaveBeenCalledOnceWith('translated:IpManager.Messages.SyncPartial', '', { status: 'danger' });
    });

    it('should stop syncing after an error, without a toast', () => {
      manager.sync.and.returnValue(throwError(() => new Error('500')));

      component.onSync();

      expect(component.syncing).toBeFalse();
      expect(toastr.show).not.toHaveBeenCalled();
      expect(cdr.markForCheck).toHaveBeenCalled();
    });
  });

  describe('onAdd', () => {
    beforeEach(() => component.onAdd());

    it('should open the editor', () => {
      expect(dialogs.open).toHaveBeenCalledOnceWith(IpEditorComponent);
    });

    it('should create the IP and reload the list after saving', () => {
      manager.create.and.returnValue(of(ip));

      dialogClose.next({ ip: '1.1.1.1' });

      expect(manager.create).toHaveBeenCalledOnceWith({ ip: '1.1.1.1' });
      expect(manager.getAll).toHaveBeenCalledTimes(1);
    });

    it('should do nothing after cancelling', () => {
      dialogClose.next(undefined);

      expect(manager.create).not.toHaveBeenCalled();
    });
  });

  describe('onEdit', () => {
    beforeEach(() => component.onEdit(ip));

    it('should pass the IP to the editor', () => {
      expect(dialogs.open).toHaveBeenCalledOnceWith(IpEditorComponent);
      expect(dialogInstance['ip']).toBe(ip);
    });

    it('should update the IP and reload the list after saving', () => {
      manager.update.and.returnValue(of(ip));

      dialogClose.next({ ip: '2.2.2.2' });

      expect(manager.update).toHaveBeenCalledOnceWith('ip-1', { ip: '2.2.2.2' });
      expect(manager.getAll).toHaveBeenCalledTimes(1);
    });

    it('should do nothing after cancelling', () => {
      dialogClose.next(undefined);

      expect(manager.update).not.toHaveBeenCalled();
    });
  });

  describe('onDelete', () => {
    beforeEach(() => component.onDelete(ip));

    it('should ask for confirmation with translated texts', () => {
      expect(dialogs.open).toHaveBeenCalledOnceWith(ConfirmDialogComponent);
      expect(dialogInstance['title']).toBe('translated:Common.Confirm');
      expect(dialogInstance['message']).toBe('translated:IpManager.ConfirmDelete');
    });

    it('should delete and reload after confirming', () => {
      manager.delete.and.returnValue(of({ success: true }));

      dialogClose.next(true);

      expect(manager.delete).toHaveBeenCalledOnceWith('ip-1');
      expect(manager.getAll).toHaveBeenCalledTimes(1);
    });

    it('should do nothing when not confirmed', () => {
      dialogClose.next(false);

      expect(manager.delete).not.toHaveBeenCalled();
    });
  });
});
