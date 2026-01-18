import { HttpHeaders, HttpParams } from "@angular/common/http";
import { ApiMessage } from "./api-message";

export abstract class RequestData {
  public endpoint: string = '';
  public headers?: HttpHeaders;
  public params?: HttpParams | object;
  public customBaseUrl?: string;
  public autoResponseHandling? = true;
  public progressIndication? = true;
  public progressTimeout?: number;
  public responseInProgressText?: string;
  public responseMessages?: ApiMessage[];
  public responseMessageProperty? = 'message';
}
