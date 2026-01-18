import { ApiMessageService } from './api-message.service';
import { ApiStatesService } from "../api-states.service";
import { ApiMessage } from "../types/api-message";

describe('ApiMessageService', () => {
  let apiMessageService: ApiMessageService;
  let apiStatesService: ApiStatesService;

  beforeEach(() => {
    apiStatesService = new ApiStatesService();
    apiMessageService = new ApiMessageService(apiStatesService);
  });

  it('should be created', () => {
    expect(apiMessageService).toBeTruthy();
  });

  it('should set message', () => {
    const message: ApiMessage = { statusCode: 200, messageText: 'test' };
    apiMessageService.setMessage(message);
    expect(apiStatesService.message.value).toEqual(message);
  });

  it('should not set message if messageText is null', () => {
    const message: ApiMessage = { statusCode: 200, messageText: null };
    apiMessageService.setMessage(message);
    expect(apiStatesService.message.value).toBeUndefined();
  });

  it('should not set message if messageText is undefined', () => {
    const message: ApiMessage = { statusCode: 200, messageText: undefined };
    apiMessageService.setMessage(message);
    expect(apiStatesService.message.value).toBeUndefined();
  });
});
