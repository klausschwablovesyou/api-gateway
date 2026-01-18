import { HttpException } from '@danet/core';

export class RedirectException extends HttpException {
  constructor(
    public readonly redirectUrl: string,
    public statusCode: number = 302
  ) {
    super(statusCode, 'Redirect');
  }
}
