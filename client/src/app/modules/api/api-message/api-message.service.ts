import { Inject, Injectable, Optional } from '@angular/core';
import { ApiStatesService } from "../api-states.service";
import { API_DEFAULT_MESSAGE_TIMEOUT, ApiMessage } from "../types/api-message";
import { isNullOrUndefined } from "@app/helpers/type.helper";
import { NbToastrService, NbGlobalPosition } from "@nebular/theme";
import { TranslateService } from "@ngx-translate/core";

@Injectable()
export class ApiMessageService {

  constructor(private _states: ApiStatesService,
              private _toastrService: NbToastrService,
              private _translateService: TranslateService,
              @Inject(API_DEFAULT_MESSAGE_TIMEOUT) @Optional() private _defaultMessageTimeout: number) {
    this._states.message.onChange((message: ApiMessage) => {
      this.showMessageToast(message);
    });
  }

  public setMessage(message: ApiMessage): void {
    if (!isNullOrUndefined(message.messageText)) {
      this._states.message.set(message);
    }
  }

  private showMessageToast(message: ApiMessage): void {
    const translatedMessage = message.messageText !== undefined
      ? this._translateService.instant(message.messageText)
      : undefined;

    const position: NbGlobalPosition = (message.position ?? 'top-right') as NbGlobalPosition;
    const status = message.status ?? 'success';

    this._toastrService.show(translatedMessage, '', {
      duration: message.timeout ?? this._defaultMessageTimeout,
      position,
      status
    });
  }
}
