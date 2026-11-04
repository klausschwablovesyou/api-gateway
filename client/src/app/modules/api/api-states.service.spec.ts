import { ApiStatesService } from './api-states.service';

describe('ApiStatesService', () => {
  it('should start with nothing in progress and no message', () => {
    const service = new ApiStatesService();

    expect(service.isResponseInProgress.value).toBeFalse();
    expect(service.isProgressIndicatorVisible.value).toBeFalse();
    expect(service.message.value).toBeNull();
    expect(service.responseInProgressText).toBeUndefined();
  });
});
