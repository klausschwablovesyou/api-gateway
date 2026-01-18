import { TestBed } from '@angular/core/testing';
import { ApiProgressIndicatorService } from './api-progress-indicator.service';
import { ApiStatesService } from "../api-states.service";

describe('ApiProgressIndicatorService', () => {
  let service: ApiProgressIndicatorService;
  let states: ApiStatesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    states = new ApiStatesService();
    service = new ApiProgressIndicatorService(3000, states);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it("should hide progress indicator when response is not in progress", () => {
    jest.useFakeTimers();
    states.isResponseInProgress.set(true);
    service.setProgressIndicatorTimeout();
    jest.advanceTimersByTime(2999);
    expect(states.isProgressIndicatorVisible.value).toBe(false);
    states.isResponseInProgress.set(false);
    jest.advanceTimersByTime(1);
    expect(states.isProgressIndicatorVisible.value).toBe(false);
  });

  it("should show progress indicator when response is in progress", () => {
    jest.useFakeTimers();
    states.isResponseInProgress.set(true);
    service.setProgressIndicatorTimeout();
    jest.advanceTimersByTime(3000);
    expect(states.isProgressIndicatorVisible.value).toBe(true);
  });

  it("should show progress indicator with custom timeout", () => {
    jest.useFakeTimers();
    states.isResponseInProgress.set(true);
    service.setProgressIndicatorTimeout(2000);
    jest.advanceTimersByTime(1999);
    expect(states.isProgressIndicatorVisible.value).toBe(false);
    jest.advanceTimersByTime(1);
    expect(states.isProgressIndicatorVisible.value).toBe(true);
  });

});
