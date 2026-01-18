import { InjectionToken } from "@angular/core";
import { ApiMessage } from "../types/api-message";

export const API_MESSAGE_SERVICE_IMPL = new InjectionToken<IApiMessageService>(
  "apiMessageServiceImpl"
);

export interface IApiMessageService {
  setMessage(message: ApiMessage): void;
}
