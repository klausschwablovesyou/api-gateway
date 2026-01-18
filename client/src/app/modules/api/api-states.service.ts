import { Injectable } from '@angular/core';
import { ApiMessage } from "./types/api-message";
import { State } from "ngx-states";

@Injectable({
  providedIn: 'root'
})
export class ApiStatesService {
  public message: State<ApiMessage> = new State<ApiMessage>();
  public responseInProgressText?: string;
  public isResponseInProgress: State<boolean> = new State<boolean>(false);
  public isProgressIndicatorVisible: State<boolean> = new State<boolean>(false);
}
