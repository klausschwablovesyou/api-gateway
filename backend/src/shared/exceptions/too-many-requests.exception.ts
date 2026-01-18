import { HttpException } from '@danet/core';
import { HttpStatusCode } from '@shared/types/http-status-code';

export class TooManyRequestsException extends HttpException {
  constructor(message: string = 'Too many requests') {
    super(HttpStatusCode.TooManyRequests, message);
  }
}
