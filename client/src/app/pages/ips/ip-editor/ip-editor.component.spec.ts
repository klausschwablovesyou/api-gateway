import { FormBuilder } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { IpEditorComponent } from './ip-editor.component';
import { Ip } from '@shared/models/ip.model';

describe('IpEditorComponent', () => {
  let dialogRef: jasmine.SpyObj<NbDialogRef<IpEditorComponent>>;
  let component: IpEditorComponent;

  beforeEach(() => {
    dialogRef = jasmine.createSpyObj<NbDialogRef<IpEditorComponent>>('NbDialogRef', ['close']);
    component = new IpEditorComponent(new FormBuilder(), dialogRef);
  });

  it('should start empty in create mode', () => {
    component.ngOnInit();

    expect(component.isEditMode).toBeFalse();
    expect(component.form.value).toEqual({ ip: '' });
    expect(component.form.valid).toBeFalse();
  });

  it('should use the address in edit mode', () => {
    component.ip = { id: 'ip-1', ip: '1.1.1.1' } as Ip;

    component.ngOnInit();

    expect(component.isEditMode).toBeTrue();
    expect(component.form.value).toEqual({ ip: '1.1.1.1' });
  });

  for (const value of ['1.2.3.4', '::1']) {
    it(`should accept ${value}`, () => {
      component.ngOnInit();
      component.form.setValue({ ip: value });

      expect(component.form.valid).toBeTrue();
    });
  }

  for (const value of ['999.1.1.1', 'localhost', '1.2.3']) {
    it(`should reject ${value}`, () => {
      component.ngOnInit();
      component.form.setValue({ ip: value });

      expect(component.form.get('ip')?.hasError('pattern')).toBeTrue();
    });
  }

  it('should close with the form value when saving a valid form', () => {
    component.ngOnInit();
    component.form.setValue({ ip: '1.2.3.4' });

    component.onSave();

    expect(dialogRef.close).toHaveBeenCalledOnceWith({ ip: '1.2.3.4' });
  });

  it('should stay open when saving an invalid form', () => {
    component.ngOnInit();

    component.onSave();

    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('should close without a value when cancelling', () => {
    component.ngOnInit();

    component.onCancel();

    expect(dialogRef.close).toHaveBeenCalledOnceWith();
  });
});
