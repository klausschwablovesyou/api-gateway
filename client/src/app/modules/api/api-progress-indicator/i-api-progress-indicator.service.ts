import { InjectionToken } from "@angular/core";

export const API_PROGRESS_INDICATOR_TIMEOUT = new InjectionToken<string>("apiProgressIndicatorTimeout");
export const API_PROGRESS_INDICATOR_SERVICE_IMPL = new InjectionToken<IApiProgressIndicatorService>(
  "apiProgressServiceImpl"
);

export interface IApiProgressIndicatorService {
  showProgressIndicator(): void;
  hideProgressIndicator(): void;
  setProgressIndicatorTimeout(customTimeout?: number): void;
}
