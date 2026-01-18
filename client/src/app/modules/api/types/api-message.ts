import { InjectionToken } from "@angular/core";
import { NbComponentStatus, NbGlobalPosition } from "@nebular/theme";

export const API_DEFAULT_MESSAGE_TIMEOUT = new InjectionToken<string>("apiDefaultMessageTimeout");

export interface ApiMessage {
  statusCode?: number
  messageText?: string;
  status?: NbComponentStatus;
  position?: NbGlobalPosition;
  timeout?: number;
  translateParams?: Object;
}
