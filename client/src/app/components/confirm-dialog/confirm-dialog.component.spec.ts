import { NbDialogRef } from '@nebular/theme';
import { ConfirmDialogComponent } from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  let dialogRef: jasmine.SpyObj<NbDialogRef<ConfirmDialogComponent>>;
  let component: ConfirmDialogComponent;

  beforeEach(() => {
    dialogRef = jasmine.createSpyObj<NbDialogRef<ConfirmDialogComponent>>('NbDialogRef', ['close']);
    component = new ConfirmDialogComponent(dialogRef);
  });

  it('should close with true when confirming', () => {
    component.onConfirm();

    expect(dialogRef.close).toHaveBeenCalledOnceWith(true);
  });

  it('should close with false when cancelling', () => {
    component.onCancel();

    expect(dialogRef.close).toHaveBeenCalledOnceWith(false);
  });
});
