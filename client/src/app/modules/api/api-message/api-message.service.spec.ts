import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { ApiMessageService } from './api-message.service';
import { ApiStatesService } from '../api-states.service';
import { ApiMessage } from '../types/api-message';

describe('ApiMessageService', () => {
  let service: ApiMessageService;
  let states: ApiStatesService;
  let toastr: jasmine.SpyObj<NbToastrService>;
  let translate: jasmine.SpyObj<TranslateService>;

  beforeEach(() => {
    states = new ApiStatesService();
    toastr = jasmine.createSpyObj<NbToastrService>('NbToastrService', ['show']);
    translate = jasmine.createSpyObj<TranslateService>('TranslateService', ['instant']);
    translate.instant.and.callFake((key: string | string[]) => `translated:${key}`);
    service = new ApiMessageService(states, toastr, translate, 2000);
  });

  it('should store the message', () => {
    const message: ApiMessage = { statusCode: 200, messageText: 'Some.Key' };

    service.setMessage(message);

    expect(states.message.value).toBe(message);
  });

  for (const messageText of [null, undefined]) {
    it(`should ignore a message whose text is ${messageText}`, () => {
      service.setMessage({ statusCode: 200, messageText: messageText as unknown as string });

      expect(states.message.value).toBeNull();
      expect(toastr.show).not.toHaveBeenCalled();
    });
  }

  it('should show a translated toast with the default settings', () => {
    service.setMessage({ messageText: 'Some.Key' });

    expect(translate.instant).toHaveBeenCalledOnceWith('Some.Key');
    expect(toastr.show).toHaveBeenCalledOnceWith('translated:Some.Key', '', {
      duration: 2000,
      position: 'top-right',
      status: 'success'
    } as never);
  });

  it('should use the status, position and timeout of the message', () => {
    service.setMessage({
      messageText: 'Some.Key',
      status: 'danger',
      position: 'bottom-left' as never,
      timeout: 500
    });

    expect(toastr.show).toHaveBeenCalledOnceWith('translated:Some.Key', '', {
      duration: 500,
      position: 'bottom-left',
      status: 'danger'
    } as never);
  });

  it('should show a toast for each new message', () => {
    service.setMessage({ messageText: 'First' });
    service.setMessage({ messageText: 'Second' });

    expect(toastr.show).toHaveBeenCalledTimes(2);
  });

  it('should not show a toast when nothing was set', () => {
    expect(toastr.show).not.toHaveBeenCalled();
  });
});
