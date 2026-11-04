import { ChangeDetectorRef } from '@angular/core';
import { ApiProgressIndicatorComponent } from './api-progress-indicator.component';
import { ApiStatesService } from '../api-states.service';

describe('ApiProgressIndicatorComponent', () => {
  let component: ApiProgressIndicatorComponent;
  let states: ApiStatesService;
  let changeRef: jasmine.SpyObj<ChangeDetectorRef>;

  beforeEach(() => {
    states = new ApiStatesService();
    changeRef = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['detectChanges']);
    component = new ApiProgressIndicatorComponent(states, changeRef);
    component.ngOnInit();
  });

  it('should start hidden with the default text, without running change detection', () => {
    expect(component.isProgressVisible).toBeFalse();
    expect(component.progressText).toBe('Common.In-progress');
    expect(changeRef.detectChanges).not.toHaveBeenCalled();
  });

  it('should follow the visibility state and run change detection', () => {
    states.isProgressIndicatorVisible.set(true);
    expect(component.isProgressVisible).toBeTrue();

    states.isProgressIndicatorVisible.set(false);
    expect(component.isProgressVisible).toBeFalse();

    expect(changeRef.detectChanges).toHaveBeenCalledTimes(2);
  });

  it('should use the text of the current request', () => {
    states.responseInProgressText = 'Saving...';

    states.isProgressIndicatorVisible.set(true);

    expect(component.progressText).toBe('Saving...');
  });

  it('should keep the current text when the request has none', () => {
    states.responseInProgressText = undefined;

    states.isProgressIndicatorVisible.set(true);

    expect(component.progressText).toBe('Common.In-progress');
  });
});
