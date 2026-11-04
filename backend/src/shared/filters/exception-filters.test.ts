import { describe, it } from '@std/testing/bdd';
import { assertEquals, assertInstanceOf, assertStrictEquals, assertThrows } from '@std/assert';
import { HttpContext, HttpException } from '@danet/core';
import { HttpExceptionFilter } from './http-exception.filter.ts';
import { RedirectExceptionFilter } from './redirect-exception.filter.ts';
import { RedirectException } from '../exceptions/redirect.exception.ts';
import { TooManyRequestsException } from '../exceptions/too-many-requests.exception.ts';

function createContext() {
  const calls = { json: [] as unknown[][], redirect: [] as unknown[][] };
  const context = {
    json: (...args: unknown[]) => {
      calls.json.push(args);
      return 'json-response';
    },
    redirect: (...args: unknown[]) => {
      calls.redirect.push(args);
      return 'redirect-response';
    },
  } as unknown as HttpContext;

  return { context, calls };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  for (const status of [400, 404, 429, 500]) {
    it(`renders a ${status} error as JSON`, () => {
      const { context, calls } = createContext();
      const exception = new HttpException(status as never, 'Something failed');

      assertEquals(filter.catch(exception, context), 'json-response');
      assertEquals(calls.json, [[{ statusCode: status, message: exception.message }, status]]);
    });
  }

  it('rethrows a RedirectException for the redirect filter', () => {
    const { context, calls } = createContext();
    const exception = new RedirectException('/login');

    assertStrictEquals(assertThrows(() => filter.catch(exception, context)), exception);
    assertEquals(calls.json.length, 0);
  });

  for (const status of [200, 226]) {
    it(`rethrows a non-error ${status} status`, () => {
      const { context, calls } = createContext();
      const exception = new HttpException(status as never, 'Not an error');

      assertStrictEquals(assertThrows(() => filter.catch(exception, context)), exception);
      assertEquals(calls.json.length, 0);
    });
  }
});

describe('RedirectExceptionFilter', () => {
  const filter = new RedirectExceptionFilter();

  it('redirects to the target with the default 302 status', () => {
    const { context, calls } = createContext();

    assertEquals(filter.catch(new RedirectException('/login'), context), 'redirect-response');
    assertEquals(calls.redirect, [['/login', 302]]);
  });

  it('keeps a custom status', () => {
    const { context, calls } = createContext();

    filter.catch(new RedirectException('/moved', 301), context);

    assertEquals(calls.redirect, [['/moved', 301]]);
  });
});

describe('custom exceptions', () => {
  it('RedirectException is an HttpException carrying the target and status', () => {
    const exception = new RedirectException('/moved', 301);

    assertInstanceOf(exception, HttpException);
    assertEquals(exception.redirectUrl, '/moved');
    assertEquals(exception.statusCode, 301);
    assertEquals(Number(exception.status), 301);
  });

  it('TooManyRequestsException has status 429 and a default message', () => {
    const exception = new TooManyRequestsException();

    assertInstanceOf(exception, HttpException);
    assertEquals(Number(exception.status), 429);
    assertEquals(exception.message.includes('Too many requests'), true);
  });

  it('TooManyRequestsException accepts a custom message', () => {
    assertEquals(new TooManyRequestsException('Slow down').message.includes('Slow down'), true);
  });
});
