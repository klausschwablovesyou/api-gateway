import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import { assert, assertEquals, assertRejects, assertStringIncludes } from '@std/assert';
import { FakeTime } from '@std/testing/time';
import { HttpException } from '@danet/core';
import { GatewayService } from './gateway.service.ts';
import { ApiRepository } from '../../shared/repositories/api.repository.ts';
import { IpRepository } from '../../shared/repositories/ip.repository.ts';
import { IpUsageRepository } from '../../shared/repositories/ip-usage.repository.ts';
import { RequestLogRepository } from '../../shared/repositories/request-log.repository.ts';
import { ApiKeyService } from '../../shared/services/api-key.service.ts';
import { RealtimeService } from '../realtime/realtime.service.ts';
import { HttpMethod } from '@shared/types/http-method.ts';
import { RequestLimitUnit } from '@shared/types/request-limit-unit.ts';
import { RealtimeTopic } from '@shared/types/realtime-topic.ts';
import { UserRole } from '@shared/types/user-role.ts';
import { Api } from '@shared/models/api.model.ts';
import { assertRejectsHttp, useSilentConsole } from '../../testing/test-helpers.ts';

const API: Api = {
  id: 'api-1',
  name: 'weather',
  apiUrl: 'https://target.test/v1/forecast',
  method: HttpMethod.GET,
  publicKey: 'public-key',
  privateKey: 'private-key',
  requestLimit: 2,
  requestLimitUnit: RequestLimitUnit.Minute,
};

const IP_A = { id: 'ip-a', ip: '10.0.0.1' };
const IP_B = { id: 'ip-b', ip: '10.0.0.2' };

/** 2026-06-15 12:30:45.500 local time. Period starts are computed in local time, like the service does. */
const NOW = new Date(2026, 5, 15, 12, 30, 45, 500).getTime();

interface Usage {
  id: string;
  ipId: string;
  apiId: string;
  lastUsedAt: number | string | bigint;
  requestLimitCounter: number | string;
}

function usage(lastUsedAt: Usage['lastUsedAt'], requestLimitCounter: Usage['requestLimitCounter']): Usage {
  return { id: 'usage-1', ipId: IP_A.id, apiId: API.id, lastUsedAt, requestLimitCounter };
}

describe('GatewayService', () => {
  useSilentConsole();

  const originalFetch = globalThis.fetch;
  const originalCreateHttpClient = Deno.createHttpClient;
  const originalRandom = Math.random;

  let time: FakeTime;
  let api: Api | null;
  let ips: Array<{ id: string; ip: string }>;
  let usages: Map<string, Usage>;
  let signatureValid: boolean;

  let createdUsage: unknown[];
  let upsertedUsage: unknown[][];
  let logs: Array<Record<string, unknown>>;
  let notifications: unknown[][];
  let requestLogFailure: Error | null;

  let fetchCalls: Array<{ url: string; init: RequestInit & { client?: unknown } }>;
  let fetchResponses: Array<Response | Error>;
  let httpClients: Array<{ options: { localAddress?: string }; closed: boolean }>;

  let service: GatewayService;

  const forward = (params: Record<string, string> = {}, publicKey = API.publicKey, signature = 'signature') =>
    service.forwardRequest(API.name, publicKey, signature, params);

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  beforeEach(() => {
    time = new FakeTime(NOW);
    api = { ...API };
    ips = [IP_A];
    usages = new Map();
    signatureValid = true;
    createdUsage = [];
    upsertedUsage = [];
    logs = [];
    notifications = [];
    requestLogFailure = null;
    fetchCalls = [];
    fetchResponses = [];
    httpClients = [];

    globalThis.fetch = ((url: string, init: RequestInit) => {
      fetchCalls.push({ url, init });
      const next = fetchResponses.shift() ?? jsonResponse({ ok: true });
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    }) as typeof fetch;

    Deno.createHttpClient = ((options: { localAddress?: string }) => {
      const client = { options, closed: false, close() { this.closed = true; } };
      httpClients.push(client);
      return client;
    }) as unknown as typeof Deno.createHttpClient;

    service = new GatewayService(
      { findByName: () => Promise.resolve(api) } as unknown as ApiRepository,
      { findAll: () => Promise.resolve(ips) } as unknown as IpRepository,
      {
        findByIpAndApi: (ipId: string) => Promise.resolve(usages.get(ipId) ?? null),
        create: (value: unknown) => {
          createdUsage.push(value);
          return Promise.resolve(value);
        },
        upsert: (...args: unknown[]) => {
          upsertedUsage.push(args);
          return Promise.resolve();
        },
      } as unknown as IpUsageRepository,
      { validateSignature: () => Promise.resolve(signatureValid) } as unknown as ApiKeyService,
      {
        create: (log: Record<string, unknown>) => {
          if (requestLogFailure) {
            return Promise.reject(requestLogFailure);
          }
          logs.push(log);
          return Promise.resolve();
        },
      } as unknown as RequestLogRepository,
      { notifyByRole: (...args: unknown[]) => notifications.push(args) } as unknown as RealtimeService,
    );
  });

  afterEach(() => {
    time.restore();
    globalThis.fetch = originalFetch;
    Deno.createHttpClient = originalCreateHttpClient;
    Math.random = originalRandom;
  });

  describe('authentication', () => {
    it('rejects an unknown API with 404 and logs it without an API id', async () => {
      api = null;

      await assertRejectsHttp(() => forward(), 404, 'API not found');

      assertEquals(logs.length, 1);
      assertEquals(logs[0].apiId, null);
      assertEquals(logs[0].ipId, null);
      assertEquals(logs[0].statusCode, 404);
      assertEquals(fetchCalls.length, 0);
    });

    it('rejects a wrong public key with 401', async () => {
      await assertRejectsHttp(() => forward({}, 'wrong-key'), 401, 'Invalid API key');

      assertEquals(logs[0].apiId, API.id);
      assertEquals(fetchCalls.length, 0);
    });

    it('rejects an invalid signature with 401', async () => {
      signatureValid = false;

      await assertRejectsHttp(() => forward(), 401, 'Invalid signature');

      assertEquals(logs[0].apiId, API.id);
      assertEquals(fetchCalls.length, 0);
    });
  });

  describe('IP selection', () => {
    it('returns 429 when there are no IPs at all', async () => {
      ips = [];

      await assertRejectsHttp(() => forward(), 429, 'No available IPs');

      assertEquals(logs[0].statusCode, 429);
      assertEquals(logs[0].ipId, null);
    });

    it('uses an IP that has no usage yet as the local address', async () => {
      await forward();

      assertEquals(httpClients[0].options.localAddress, IP_A.ip);
    });

    it('uses an IP below the limit in the current period', async () => {
      usages.set(IP_A.id, usage(NOW - 1000, API.requestLimit - 1));

      await forward();

      assertEquals(fetchCalls.length, 1);
    });

    it('returns 429 when the only IP reached the limit in the current period', async () => {
      usages.set(IP_A.id, usage(NOW - 1000, API.requestLimit));

      await assertRejectsHttp(() => forward(), 429);

      assertEquals(fetchCalls.length, 0);
    });

    it('skips exhausted IPs', async () => {
      ips = [IP_A, IP_B];
      usages.set(IP_A.id, usage(NOW - 1000, API.requestLimit));
      Math.random = () => 0;

      await forward();

      assertEquals(httpClients[0].options.localAddress, IP_B.ip);
    });

    it('picks randomly among the available IPs', async () => {
      ips = [IP_A, IP_B];

      Math.random = () => 0;
      await forward();
      Math.random = () => 0.99;
      await forward();

      assertEquals(httpClients.map((client) => client.options.localAddress), [IP_A.ip, IP_B.ip]);
    });

    it('handles counters and timestamps that the database returns as strings or bigints', async () => {
      usages.set(IP_A.id, usage(BigInt(NOW - 1000), String(API.requestLimit)));
      await assertRejectsHttp(() => forward(), 429);

      usages.set(IP_A.id, usage(String(NOW - 1000), String(API.requestLimit - 1)));
      await forward();
      assertEquals(upsertedUsage[0][3], API.requestLimit);
    });

    const periods: Array<[RequestLimitUnit, Date]> = [
      [RequestLimitUnit.Second, new Date(2026, 5, 15, 12, 30, 45, 0)],
      [RequestLimitUnit.Minute, new Date(2026, 5, 15, 12, 30, 0, 0)],
      [RequestLimitUnit.Hour, new Date(2026, 5, 15, 12, 0, 0, 0)],
      [RequestLimitUnit.Day, new Date(2026, 5, 15, 0, 0, 0, 0)],
    ];

    for (const [unit, periodStart] of periods) {
      it(`counts usage from the start of the current ${unit} against the limit`, async () => {
        api = { ...API, requestLimitUnit: unit };
        usages.set(IP_A.id, usage(periodStart.getTime(), API.requestLimit));

        await assertRejectsHttp(() => forward(), 429);
      });

      it(`ignores exhausted usage from before the current ${unit}`, async () => {
        api = { ...API, requestLimitUnit: unit };
        usages.set(IP_A.id, usage(periodStart.getTime() - 1, API.requestLimit));

        await forward();

        assertEquals(fetchCalls.length, 1);
      });
    }
  });

  describe('usage tracking', () => {
    it('creates the usage with counter 1 for the first request', async () => {
      await forward();

      assertEquals(createdUsage, [{ ipId: IP_A.id, apiId: API.id, lastUsedAt: NOW, requestLimitCounter: 1 }]);
      assertEquals(upsertedUsage.length, 0);
    });

    it('increments the counter within the same period', async () => {
      usages.set(IP_A.id, usage(NOW - 1000, 1));

      await forward();

      assertEquals(upsertedUsage, [[IP_A.id, API.id, NOW, 2]]);
    });

    it('restarts the counter in a new period', async () => {
      usages.set(IP_A.id, usage(NOW - 3_600_000, 50));

      await forward();

      assertEquals(upsertedUsage, [[IP_A.id, API.id, NOW, 1]]);
    });

    it('does not count a request that the target rejected', async () => {
      fetchResponses = [new Response('nope', { status: 500, statusText: 'Server Error' })];

      await assertRejects(() => forward());

      assertEquals(createdUsage.length, 0);
      assertEquals(upsertedUsage.length, 0);
    });
  });

  describe('URL and body building', () => {
    it('replaces path placeholders and URL-encodes their values', async () => {
      api = { ...API, apiUrl: 'https://target.test/{city}/days/{days}' };

      await forward({ city: 'New York/NY', days: '3' });

      assertEquals(fetchCalls[0].url, 'https://target.test/New%20York%2FNY/days/3');
    });

    it('leaves a placeholder without a matching parameter in place', async () => {
      api = { ...API, apiUrl: 'https://target.test/{city}' };

      await forward();

      assertEquals(decodeURI(fetchCalls[0].url), 'https://target.test/{city}');
    });

    it('replaces every occurrence of a repeated placeholder', async () => {
      api = { ...API, apiUrl: 'https://target.test/{id}/related/{id}' };

      await forward({ id: '7' });

      assertEquals(fetchCalls[0].url, 'https://target.test/7/related/7');
    });

    it('does not treat inherited object properties as parameters', async () => {
      api = { ...API, apiUrl: 'https://target.test/{constructor}' };

      await forward();

      assertEquals(decodeURI(fetchCalls[0].url), 'https://target.test/{constructor}');
    });

    for (const method of [HttpMethod.GET, HttpMethod.DELETE]) {
      it(`${method} sends the remaining parameters in the query string, without a body`, async () => {
        api = { ...API, method, apiUrl: 'https://target.test/{city}' };

        await forward({ city: 'Pecs', units: 'metric', q: 'a b' });

        assertEquals(fetchCalls[0].url, 'https://target.test/Pecs?units=metric&q=a+b');
        assertEquals(fetchCalls[0].init.method, method);
        assertEquals(fetchCalls[0].init.body, undefined);
      });
    }

    for (const method of [HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH]) {
      it(`${method} sends the remaining parameters as a JSON body`, async () => {
        api = { ...API, method, apiUrl: 'https://target.test/{city}' };

        await forward({ city: 'Pecs', units: 'metric' });

        assertEquals(fetchCalls[0].url, 'https://target.test/Pecs');
        assertEquals(fetchCalls[0].init.method, method);
        assertEquals(fetchCalls[0].init.body, '{"units":"metric"}');
        assertEquals(fetchCalls[0].init.headers, { 'Content-Type': 'application/json' });
      });
    }
  });

  describe('response handling', () => {
    it('parses a JSON response', async () => {
      fetchResponses = [jsonResponse({ temperature: 21 })];

      assertEquals(await forward(), { temperature: 21 });
    });

    it('accepts a JSON content type with a charset', async () => {
      fetchResponses = [
        new Response('{"a":1}', { headers: { 'content-type': 'application/json; charset=utf-8' } }),
      ];

      assertEquals(await forward(), { a: 1 });
    });

    it('wraps malformed JSON in a data property', async () => {
      fetchResponses = [new Response('{broken', { headers: { 'content-type': 'application/json' } })];

      assertEquals(await forward(), { data: '{broken' });
    });

    it('wraps a non-JSON response in a data property', async () => {
      fetchResponses = [new Response('plain text', { headers: { 'content-type': 'text/plain' } })];

      assertEquals(await forward(), { data: 'plain text' });
    });

    it('passes the status of a failed target response through, and does not retry', async () => {
      fetchResponses = [new Response('nope', { status: 503, statusText: 'Service Unavailable' })];

      await assertRejectsHttp(() => forward(), 503, 'Target API returned 503: Service Unavailable');

      assertEquals(fetchCalls.length, 1);
      assertEquals(logs[0].statusCode, 503);
      assertEquals(logs[0].ipId, IP_A.id);
    });

    it('closes the HTTP client after a success and after a failure', async () => {
      await forward();
      fetchResponses = [new Response('nope', { status: 500 })];
      await assertRejects(() => forward());

      assertEquals(httpClients.map((client) => client.closed), [true, true]);
    });

    it('ignores an error while closing the HTTP client', async () => {
      Deno.createHttpClient = (() => ({
        close: () => {
          throw new Error('already closed');
        },
      })) as unknown as typeof Deno.createHttpClient;

      assertEquals(await forward(), { ok: true });
    });
  });

  describe('connection retry', () => {
    const coded = (code: string) => Object.assign(new Error('socket failed'), { code });
    const brokenConnections: Array<[string, Error]> = [
      ['EPIPE', coded('EPIPE')],
      ['ECONNRESET', coded('ECONNRESET')],
      ['a BrokenPipe message', new Error('BrokenPipe: write failed')],
      ['a "connection closed" message', new Error('error: connection closed before message completed')],
      ['a "Connection reset" message', new Error('Connection reset by peer')],
    ];

    for (const [description, error] of brokenConnections) {
      it(`retries once with a new client after ${description}`, async () => {
        fetchResponses = [error, jsonResponse({ retried: true })];

        assertEquals(await forward(), { retried: true });
        assertEquals(fetchCalls.length, 2);
        assertEquals(httpClients.length, 2);
        assertEquals(httpClients.map((client) => client.closed), [true, true]);
      });
    }

    it('fails with 500 when the retry also fails', async () => {
      fetchResponses = [coded('EPIPE'), coded('EPIPE')];

      await assertRejectsHttp(() => forward(), 500, 'Request failed');

      assertEquals(fetchCalls.length, 2);
    });

    it('does not retry other errors', async () => {
      fetchResponses = [new Error('dns error')];

      await assertRejectsHttp(() => forward(), 500, 'dns error');

      assertEquals(fetchCalls.length, 1);
    });

    it('does not retry a non-Error rejection', async () => {
      globalThis.fetch = (() => {
        fetchCalls.push({ url: '', init: {} });
        return Promise.reject('plain failure');
      }) as typeof fetch;

      await assertRejectsHttp(() => forward(), 500, 'plain failure');

      assertEquals(fetchCalls.length, 1);
    });
  });

  describe('error logging', () => {
    it('stores the error details and notifies SuperAdmins', async () => {
      signatureValid = false;

      const error = await assertRejects(() => forward(), HttpException);

      assertEquals(logs, [{
        apiId: API.id,
        ipId: null,
        errorMessage: error.message,
        statusCode: 401,
        occurredAt: NOW,
      }]);
      assertEquals(notifications, [[UserRole.SuperAdmin, RealtimeTopic.RequestError]]);
    });

    it('logs an unexpected error as 500 and rethrows the original error', async () => {
      api = { ...API, apiUrl: 'not a valid url' };

      const error = await assertRejects(() => forward(), TypeError);

      assertEquals(logs[0].statusCode, 500);
      assertStringIncludes(logs[0].errorMessage as string, error.message);
      assertEquals(logs[0].ipId, IP_A.id);
    });

    it('keeps the original error when logging itself fails', async () => {
      requestLogFailure = new Error('database down');
      signatureValid = false;

      await assertRejectsHttp(() => forward(), 401, 'Invalid signature');

      assertEquals(notifications.length, 0);
    });

    it('does not log a successful request', async () => {
      await forward();

      assertEquals(logs.length, 0);
      assert(notifications.length === 0);
    });
  });
});
