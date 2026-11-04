import { afterEach, beforeEach } from '@std/testing/bdd';
import { assertEquals, assertRejects, assertStringIncludes } from '@std/assert';
import { HttpException } from '@danet/core';

const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug'] as const;

/** Silences console output for every test of the enclosing `describe` block. */
export function useSilentConsole(): void {
  const originals = new Map<string, unknown>();

  beforeEach(() => {
    for (const method of CONSOLE_METHODS) {
      originals.set(method, console[method]);
      console[method] = () => {};
    }
  });

  afterEach(() => {
    for (const method of CONSOLE_METHODS) {
      console[method] = originals.get(method) as typeof console.log;
    }
  });
}

/** Sets environment variables for one test and returns a function that restores the previous values. */
export function withEnv(values: Record<string, string | undefined>): () => void {
  const previous = new Map(Object.keys(values).map((key) => [key, Deno.env.get(key)]));

  const apply = (entries: Iterable<[string, string | undefined]>) => {
    for (const [key, value] of entries) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
  };

  apply(Object.entries(values));
  return () => apply(previous);
}

/** Asserts that the call rejects with a Danet HttpException of the given status. */
export async function assertRejectsHttp(
  call: () => Promise<unknown>,
  status: number,
  messageIncludes?: string,
): Promise<HttpException> {
  const error = await assertRejects(call, HttpException);
  assertEquals(Number(error.status), status);
  if (messageIncludes) {
    assertStringIncludes(error.message, messageIncludes);
  }
  return error;
}

export interface RecordedQuery {
  method: 'query' | 'queryOne' | 'execute';
  sql: string;
  params?: unknown[];
}

export interface FakePostgresResults {
  query?: unknown[];
  queryOne?: unknown;
  execute?: number;
}

/** In-memory stand-in for PostgresService: records each statement and answers with canned results. */
export class FakePostgres {
  public readonly calls: RecordedQuery[] = [];

  public constructor(public results: FakePostgresResults = {}) {}

  public query(sql: string, params?: unknown[]): Promise<unknown[]> {
    this.calls.push({ method: 'query', sql, params });
    return Promise.resolve(this.results.query ?? []);
  }

  public queryOne(sql: string, params?: unknown[]): Promise<unknown> {
    this.calls.push({ method: 'queryOne', sql, params });
    return Promise.resolve(this.results.queryOne ?? null);
  }

  public execute(sql: string, params?: unknown[]): Promise<number> {
    this.calls.push({ method: 'execute', sql, params });
    return Promise.resolve(this.results.execute ?? 0);
  }

  public get lastCall(): RecordedQuery {
    return this.calls[this.calls.length - 1];
  }
}

export interface FakeCommandResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
}

export interface CommandMock {
  /** Every spawned command as `[program, ...args]`. */
  calls: string[][];
  restore(): void;
}

/**
 * Replaces `Deno.Command` so no real process is spawned. The handler receives
 * `[program, ...args]`; it may return a result or throw (e.g. binary not found).
 */
export function mockDenoCommand(handler: (command: string[]) => FakeCommandResult): CommandMock {
  const descriptor = Object.getOwnPropertyDescriptor(Deno, 'Command')!;
  const calls: string[][] = [];
  const encoder = new TextEncoder();

  class FakeCommand {
    private readonly _command: string[];

    public constructor(program: string, options?: { args?: string[] }) {
      this._command = [program, ...(options?.args ?? [])];
      calls.push(this._command);
    }

    public output(): Promise<{ success: boolean; stdout: Uint8Array; stderr: Uint8Array }> {
      try {
        const result = handler(this._command);
        return Promise.resolve({
          success: result.success,
          stdout: encoder.encode(result.stdout ?? ''),
          stderr: encoder.encode(result.stderr ?? ''),
        });
      } catch (err) {
        return Promise.reject(err);
      }
    }
  }

  Object.defineProperty(Deno, 'Command', { configurable: true, writable: true, value: FakeCommand });

  return {
    calls,
    restore: () => Object.defineProperty(Deno, 'Command', descriptor),
  };
}

/** Minimal WebSocket double for realtime tests. */
export class FakeSocket {
  public readonly sent: string[] = [];
  public closed: { code?: number; reason?: string } | null = null;
  public onclose: (() => void) | null = null;

  public constructor(public readyState: number = WebSocket.OPEN) {}

  public send(message: string): void {
    this.sent.push(message);
  }

  public close(code?: number, reason?: string): void {
    this.closed = { code, reason };
  }

  public asWebSocket(): WebSocket {
    return this as unknown as WebSocket;
  }
}
