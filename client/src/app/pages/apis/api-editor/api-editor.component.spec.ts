import { ChangeDetectorRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { ApiEditorComponent } from './api-editor.component';
import { Api } from '@shared/models/api.model';
import { HttpMethod } from '@shared/types/http-method';
import { RequestLimitUnit } from '@shared/types/request-limit-unit';

describe('ApiEditorComponent', () => {
  const VALID = {
    name: 'weather',
    apiUrl: 'https://example.com/{city}',
    method: HttpMethod.POST,
    requestLimit: 5,
    requestLimitUnit: RequestLimitUnit.Hour
  };

  let dialogRef: jasmine.SpyObj<NbDialogRef<ApiEditorComponent>>;
  let component: ApiEditorComponent;

  beforeEach(() => {
    dialogRef = jasmine.createSpyObj<NbDialogRef<ApiEditorComponent>>('NbDialogRef', ['close']);
    component = new ApiEditorComponent(new FormBuilder(), dialogRef, {} as ChangeDetectorRef);
  });

  describe('create mode', () => {
    beforeEach(() => component.ngOnInit());

    it('should not be in edit mode', () => {
      expect(component.isEditMode).toBeFalse();
    });

    it('should use the defaults', () => {
      expect(component.form.value).toEqual({
        name: '',
        apiUrl: '',
        method: HttpMethod.GET,
        requestLimit: 100,
        requestLimitUnit: RequestLimitUnit.Minute
      });
    });

    it('should offer every method and unit', () => {
      expect(component.httpMethods).toEqual(Object.values(HttpMethod));
      expect(component.requestLimitUnits).toEqual(Object.values(RequestLimitUnit));
    });
  });

  describe('edit mode', () => {
    beforeEach(() => {
      component.api = { id: 'api-1', ...VALID } as Api;
      component.ngOnInit();
    });

    it('should be in edit mode, with the values of the API', () => {
      expect(component.isEditMode).toBeTrue();
      expect(component.form.value).toEqual(VALID);
    });
  });

  describe('validation', () => {
    beforeEach(() => component.ngOnInit());

    const invalid: Array<[string, string, unknown, string]> = [
      ['an empty name', 'name', '', 'required'],
      ['a name that is too short', 'name', 'a', 'minlength'],
      ['a name that is too long', 'name', 'a'.repeat(101), 'maxlength'],
      ['an empty URL', 'apiUrl', '', 'required'],
      ['a URL without a scheme', 'apiUrl', 'example.com', 'pattern'],
      ['an empty method', 'method', '', 'required'],
      ['a limit below 1', 'requestLimit', 0, 'min'],
      ['a limit above 1000000', 'requestLimit', 1000001, 'max'],
      ['an empty unit', 'requestLimitUnit', '', 'required'],
    ];

    for (const [description, field, value, error] of invalid) {
      it(`should reject ${description}`, () => {
        component.form.setValue({ ...VALID, [field]: value });

        expect(component.form.get(field)?.hasError(error)).toBeTrue();
        expect(component.form.valid).toBeFalse();
      });
    }

    it('should accept the limits of the allowed range', () => {
      component.form.setValue({ ...VALID, requestLimit: 1 });
      expect(component.form.valid).toBeTrue();

      component.form.setValue({ ...VALID, requestLimit: 1000000 });
      expect(component.form.valid).toBeTrue();
    });
  });

  describe('dialog', () => {
    beforeEach(() => component.ngOnInit());

    it('should close with the form value when saving a valid form', () => {
      component.form.setValue(VALID);

      component.onSave();

      expect(dialogRef.close).toHaveBeenCalledOnceWith(VALID);
    });

    it('should stay open when saving an invalid form', () => {
      component.onSave();

      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('should close without a value when cancelling', () => {
      component.onCancel();

      expect(dialogRef.close).toHaveBeenCalledOnceWith();
    });
  });
});
