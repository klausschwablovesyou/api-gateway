import { Injectable, Catch, HttpContext } from '@danet/core';
import { RedirectException } from '../exceptions/redirect.exception.ts';

@Injectable()
@Catch(RedirectException)
export class RedirectExceptionFilter {
  public catch(exception: RedirectException, ctx: HttpContext) {
    // Use Hono's redirect method directly
    return ctx.redirect(exception.redirectUrl, exception.statusCode);
  }
}