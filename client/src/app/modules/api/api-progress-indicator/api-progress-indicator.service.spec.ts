import { ApiProgressIndicatorService } from './api-progress-indicator.service';
import { ApiStatesService } from '../api-states.service';

describe('ApiProgressIndicatorService', () => {
  let service: ApiProgressIndicatorService;
  let states: ApiStatesService;

  beforeEach(() => {
    jasmine.clock().install();
    states = new ApiStatesService();
    service = new ApiProgressIndicatorService(3000, states);
  });

  afterEach(() => jasmine.clock().uninstall());

  it('should show the indicator when the response is still in progress after the timeout', () => {
    states.isResponseInProgress.set(true);
    service.setProgressIndicatorTimeout();

    jasmine.clock().tick(2999);
    expect(states.isProgressIndicatorVisible.value).toBeFalse();

    jasmine.clock().tick(1);
    expect(states.isProgressIndicatorVisible.value).toBeTrue();
  });

  it('should prefer a custom timeout', () => {
    states.isResponseInProgress.set(true);
    service.setProgressIndicatorTimeout(2000);

    jasmine.clock().tick(1999);
    expect(states.isProgressIndicatorVisible.value).toBeFalse();

    jasmine.clock().tick(1);
    expect(states.isProgressIndicatorVisible.value).toBeTrue();
  });

  it('should never show the indicator when the response arrives before the timeout', () => {
    states.isResponseInProgress.set(true);
    service.setProgressIndicatorTimeout();

    jasmine.clock().tick(2999);
    states.isResponseInProgress.set(false);
    jasmine.clock().tick(1);

    expect(states.isProgressIndicatorVisible.value).toBeFalse();
  });

  it('should hide a visible indicator when the response arrives', () => {
    states.isResponseInProgress.set(true);
    service.setProgressIndicatorTimeout();
    jasmine.clock().tick(3000);

    states.isResponseInProgress.set(false);

    expect(states.isProgressIndicatorVisible.value).toBeFalse();
  });

  it('should not show the indicator when nothing is in progress at the timeout', () => {
    service.setProgressIndicatorTimeout();

    jasmine.clock().tick(3000);

    expect(states.isProgressIndicatorVisible.value).toBeFalse();
  });

  it('should update the progress state', () => {
    service.setResponseProgression(true);
    expect(states.isResponseInProgress.value).toBeTrue();

    service.setResponseProgression(false);
    expect(states.isResponseInProgress.value).toBeFalse();
  });

  it('should show and hide the indicator directly', () => {
    service.showProgressIndicator();
    expect(states.isProgressIndicatorVisible.value).toBeTrue();

    service.hideProgressIndicator();
    expect(states.isProgressIndicatorVisible.value).toBeFalse();
  });
});
