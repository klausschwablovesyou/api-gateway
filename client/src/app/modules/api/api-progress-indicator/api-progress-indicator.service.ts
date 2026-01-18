import { Inject, Injectable, Optional } from '@angular/core';
import { API_PROGRESS_INDICATOR_TIMEOUT, IApiProgressIndicatorService } from "./i-api-progress-indicator.service";
import { ApiStatesService } from "../api-states.service";
import { filter, skip } from "rxjs/operators";

@Injectable()
export class ApiProgressIndicatorService implements IApiProgressIndicatorService{

  private _progressIndicatorTimeoutId?: ReturnType<typeof setTimeout>;
  constructor(
    @Inject(API_PROGRESS_INDICATOR_TIMEOUT) @Optional() private _progressTimeout: number,
    private _states: ApiStatesService) {
    this._states.isResponseInProgress.state
      .pipe(skip(1))
      .pipe(filter(isInProgress => isInProgress === false))
      .subscribe(_ => this.hideProgressIndicator());
  }

  public setProgressIndicatorTimeout(customTimeout?: number) {
    const timeout = customTimeout ?? this._progressTimeout;
    this._progressIndicatorTimeoutId = setTimeout(() => this.onTimedOut(), timeout);
  }

  public setResponseProgression(isInProgress: boolean): void {
    this._states.isResponseInProgress.set(isInProgress);
  }

  public showProgressIndicator() {
    this._states.isProgressIndicatorVisible.set(true);
  }

  public hideProgressIndicator(): void {
    this._states.isProgressIndicatorVisible.set(false);
    clearTimeout(this._progressIndicatorTimeoutId);
  }

  private onTimedOut(): void {
    if (this._states.isResponseInProgress.value) {
      this._states.isProgressIndicatorVisible.set(true);
    }
    clearTimeout(this._progressIndicatorTimeoutId);
  }
}
