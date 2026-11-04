import { ChangeDetectorRef } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { of, Subject } from 'rxjs';
import { ApisComponent } from './apis.component';
import { ApiEditorComponent } from './api-editor/api-editor.component';
import { ApiCodeExampleComponent } from './api-code-example/api-code-example.component';
import { ConfirmDialogComponent } from '@app/components/confirm-dialog/confirm-dialog.component';
import { ApiManagerService } from '@app/managers/api-manager/api-manager.service';
import { Api } from '@shared/models/api.model';

describe('ApisComponent', () => {
  const first = { id: 'api-1', name: 'first' } as Api;
  const second = { id: 'api-2', name: 'second' } as Api;

  let manager: jasmine.SpyObj<ApiManagerService>;
  let cdr: jasmine.SpyObj<ChangeDetectorRef>;
  let dialogs: jasmine.SpyObj<NbDialogService>;
  let translate: jasmine.SpyObj<TranslateService>;
  let dialogClose: Subject<unknown>;
  let dialogInstance: Record<string, unknown>;
  let component: ApisComponent;

  beforeEach(() => {
    manager = jasmine.createSpyObj<ApiManagerService>('ApiManagerService', ['getAll', 'create', 'update', 'delete']);
    manager.getAll.and.returnValue(of([first, second]));
    cdr = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck']);
    translate = jasmine.createSpyObj<TranslateService>('TranslateService', ['instant']);
    translate.instant.and.callFake((key: string | string[]) => `translated:${key}`);

    dialogClose = new Subject();
    dialogInstance = {};
    dialogs = jasmine.createSpyObj<NbDialogService>('NbDialogService', ['open']);
    dialogs.open.and.returnValue({ onClose: dialogClose, componentRef: { instance: dialogInstance } } as never);

    component = new ApisComponent(manager, cdr, dialogs, translate);
  });

  it('should load the APIs on init', () => {
    component.ngOnInit();

    expect(component.apis).toEqual([first, second]);
    expect(cdr.markForCheck).toHaveBeenCalled();
  });

  describe('onAdd', () => {
    beforeEach(() => {
      component.apis = [first];
      component.onAdd();
    });

    it('should open the editor', () => {
      expect(dialogs.open).toHaveBeenCalledOnceWith(ApiEditorComponent);
    });

    it('should create the API and put it first in the list', () => {
      manager.create.and.returnValue(of(second));

      dialogClose.next({ name: 'second' });

      expect(manager.create).toHaveBeenCalledOnceWith({ name: 'second' } as never);
      expect(component.apis).toEqual([second, first]);
      expect(cdr.markForCheck).toHaveBeenCalled();
    });

    it('should do nothing after cancelling', () => {
      dialogClose.next(undefined);

      expect(manager.create).not.toHaveBeenCalled();
    });
  });

  describe('onEdit', () => {
    const updated = { ...first, name: 'renamed' } as Api;

    beforeEach(() => {
      component.apis = [first, second];
      component.onEdit(first);
    });

    it('should pass the API to the editor', () => {
      expect(dialogs.open).toHaveBeenCalledOnceWith(ApiEditorComponent);
      expect(dialogInstance['api']).toBe(first);
    });

    it('should replace the API in a new list after saving', () => {
      const previous = component.apis;
      manager.update.and.returnValue(of(updated));

      dialogClose.next({ name: 'renamed' });

      expect(manager.update).toHaveBeenCalledOnceWith('api-1', { name: 'renamed' } as never);
      expect(component.apis).toEqual([updated, second]);
      expect(component.apis).not.toBe(previous);
      expect(cdr.markForCheck).toHaveBeenCalled();
    });

    it('should ignore the result when the API has left the list', () => {
      manager.update.and.returnValue(of(updated));
      component.apis = [second];

      dialogClose.next({ name: 'renamed' });

      expect(component.apis).toEqual([second]);
    });

    it('should do nothing after cancelling', () => {
      dialogClose.next(undefined);

      expect(manager.update).not.toHaveBeenCalled();
    });
  });

  describe('onDelete', () => {
    beforeEach(() => component.onDelete(first));

    it('should ask for confirmation with translated texts', () => {
      expect(dialogs.open).toHaveBeenCalledOnceWith(ConfirmDialogComponent);
      expect(dialogInstance['title']).toBe('translated:Common.Confirm');
      expect(dialogInstance['message']).toBe('translated:ApiManager.ConfirmDelete');
    });

    it('should delete and reload after confirming', () => {
      manager.delete.and.returnValue(of({ success: true }));

      dialogClose.next(true);

      expect(manager.delete).toHaveBeenCalledOnceWith('api-1');
      expect(manager.getAll).toHaveBeenCalledTimes(1);
    });

    it('should do nothing when not confirmed', () => {
      dialogClose.next(false);

      expect(manager.delete).not.toHaveBeenCalled();
    });
  });

  it('should open the code example with the API', () => {
    component.onShowCodeExample(first);

    expect(dialogs.open).toHaveBeenCalledOnceWith(ApiCodeExampleComponent);
    expect(dialogInstance['api']).toBe(first);
  });

  it('should copy a value to the clipboard', async () => {
    const write = spyOn(navigator.clipboard, 'writeText').and.resolveTo();

    await component.copyToClipboard('secret');

    expect(write).toHaveBeenCalledOnceWith('secret');
  });
});
