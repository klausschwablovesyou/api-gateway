import { NbDialogRef } from '@nebular/theme';
import { ApiCodeExampleComponent } from './api-code-example.component';

describe('ApiCodeExampleComponent', () => {
  let dialogRef: jasmine.SpyObj<NbDialogRef<ApiCodeExampleComponent>>;
  let component: ApiCodeExampleComponent;
  let write: jasmine.Spy;

  /** The language components are view children, which only exist for the selected language. */
  function setChildren(children: { python?: string; rust?: string }): void {
    const target = component as unknown as Record<string, unknown>;
    target['_pyComp'] = children.python === undefined ? undefined : { getCode: () => children.python };
    target['_rsComp'] = children.rust === undefined ? undefined : { getCode: () => children.rust };
  }

  beforeEach(() => {
    dialogRef = jasmine.createSpyObj<NbDialogRef<ApiCodeExampleComponent>>('NbDialogRef', ['close']);
    component = new ApiCodeExampleComponent(dialogRef);
    write = spyOn(navigator.clipboard, 'writeText').and.resolveTo();
  });

  it('should default to Python and the gateway of the current origin', () => {
    expect(component.selectedLanguage).toBe('python');
    expect(component.gatewayUrl).toBe(`${window.location.origin}/api/gateway`);
  });

  it('should copy the Python code when Python is selected', async () => {
    setChildren({ python: 'print()', rust: 'fn main() {}' });

    await component.copyToClipboard();

    expect(write).toHaveBeenCalledOnceWith('print()');
  });

  it('should copy the Rust code when Rust is selected', async () => {
    setChildren({ python: 'print()', rust: 'fn main() {}' });
    component.selectedLanguage = 'rust';

    await component.copyToClipboard();

    expect(write).toHaveBeenCalledOnceWith('fn main() {}');
  });

  it('should copy nothing when the code is not rendered', async () => {
    setChildren({});

    await component.copyToClipboard();

    expect(write).not.toHaveBeenCalled();
  });

  it('should close the dialog', () => {
    component.onClose();

    expect(dialogRef.close).toHaveBeenCalledTimes(1);
  });
});
