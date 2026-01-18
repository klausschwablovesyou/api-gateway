import { Injectable, Catch, HttpContext, HttpException } from '@danet/core';
import { RedirectException } from '../exceptions/redirect.exception.ts';
import { HttpStatusCode } from '@shared/types/http-status-code';

@Injectable()
@Catch(HttpException)
export class HttpExceptionFilter {
  public catch(exception: HttpException, ctx: HttpContext) {
    // Don't handle RedirectExceptions - let RedirectExceptionFilter handle them
    if (exception instanceof RedirectException) {
      throw exception;
    }

    const statusCode = exception.status;
    const message = exception.message;

    // Only handle non-2xx responses
    if (statusCode > HttpStatusCode.ImUsed) {
      return ctx.json(
        {
          statusCode,
          message
        },
        statusCode
      );
    }

    // For 2xx responses, just pass through
    throw exception;
  }
}
