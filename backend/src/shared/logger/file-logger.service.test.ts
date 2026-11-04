import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import { assertEquals, assertStringIncludes } from '@std/assert';
import { FileLoggerService } from './file-logger.service.ts';
import { LogLevel } from '@shared/types/log-level.ts';
import { RealtimeTopic } from '@shared/types/realtime-topic.ts';
import { UserRole } from '@shared/types/user-role.ts';

describe('FileLoggerService', () => {
  const METHODS = ['log', 'error', 'warn', 'info', 'debug'] as const;
  const originalWrite = Deno.writeTextFile;
  const originals = new Map<string, typeof console.log>();

  let written: Array<{ path: string; content: string }>;
  let printed: Array<{ method: string; args: unknown[] }>;
  let logger: FileLoggerService;

  beforeEach(() => {
    written = [];
    printed = [];

    Deno.writeTextFile = ((path: string, content: string) => {
      written.push({ path, content });
      return Promise.resolve();
    }) as typeof Deno.writeTextFile;

    for (const method of METHODS) {
      originals.set(method, console[method]);
      console[method] = (...args: unknown[]) => printed.push({ method, args });
    }

    logger = new FileLoggerService('test-logs');
    (logger as unknown as { patchConsoleMethods(): void }).patchConsoleMethods();
  });

  afterEach(() => {
    Deno.writeTextFile = originalWrite;
    for (const method of METHODS) {
      console[method] = originals.get(method)!;
    }
  });

  const appLog = () => written.filter((entry) => entry.path.startsWith('test-logs/app-'));
  const errorLog = () => written.filter((entry) => entry.path.startsWith('test-logs/error-'));

  it('still prints to the original console', () => {
    console.log('hello');

    assertEquals(printed, [{ method: 'log', args: ['hello'] }]);
  });

  for (const [method, label] of [['log', 'LOG'], ['warn', 'WARN'], ['info', 'INFO'], ['debug', 'DEBUG']] as const) {
    it(`writes console.${method} only to the app log`, () => {
      console[method]('message');

      assertEquals(appLog().length, 1);
      assertEquals(errorLog().length, 0);
      assertStringIncludes(appLog()[0].content, `[${label}] message\n`);
    });
  }

  it('writes console.error to both the error log and the app log', () => {
    console.error('failure');

    assertEquals(errorLog().length, 1);
    assertEquals(appLog().length, 1);
    assertStringIncludes(errorLog()[0].content, '[ERROR] failure\n');
  });

  it('names the log files after the current date', () => {
    console.log('message');

    assertEquals(appLog()[0].path, `test-logs/app-${new Date().toISOString().split('T')[0]}.log`);
  });

  it('serializes objects and joins arguments with spaces', () => {
    console.log('user', { id: 1 }, 42);

    assertStringIncludes(appLog()[0].content, 'user {"id":1} 42');
  });

  it('does not throw on circular objects', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    console.log(circular);

    assertStringIncludes(logger.getLogBuffer()[0].message, '[object Object]');
    assertStringIncludes(appLog()[0].content, '[object Object]');
  });

  it('reports a failed file write on the original console instead of throwing', async () => {
    const failure = new Error('disk full');
    Deno.writeTextFile = (() => Promise.reject(failure)) as typeof Deno.writeTextFile;

    console.log('message');
    await new Promise((resolve) => setTimeout(resolve, 0));

    assertEquals(printed.at(-1), {
      method: 'error',
      args: ['[FileLogger] Failed to write to log file:', failure],
    });
  });

  describe('log buffer', () => {
    it('stores entries with their level and message', () => {
      console.warn('careful');

      const [entry] = logger.getLogBuffer();
      assertEquals(entry.level, LogLevel.WARN);
      assertEquals(entry.message, 'careful');
    });

    it('keeps only the 100 most recent entries', () => {
      for (let i = 0; i < 105; i++) {
        console.log(`entry ${i}`);
      }

      const buffer = logger.getLogBuffer();
      assertEquals(buffer.length, 100);
      assertEquals(buffer[0].message, 'entry 5');
      assertEquals(buffer[99].message, 'entry 104');
    });

    it('returns a copy of the buffer', () => {
      console.log('entry');

      logger.getLogBuffer().pop();

      assertEquals(logger.getLogBuffer().length, 1);
    });
  });

  describe('realtime broadcast', () => {
    it('sends each entry to SuperAdmin users', () => {
      const notified: unknown[][] = [];
      logger.setRealtimeService({
        notifyByRole: (...args: unknown[]) => notified.push(args),
      } as never);

      console.error('failure');

      assertEquals(notified.length, 1);
      assertEquals(notified[0][0], UserRole.SuperAdmin);
      assertEquals(notified[0][1], RealtimeTopic.ConsoleLog);
      assertEquals((notified[0][2] as { message: string }).message, 'failure');
    });
  });

  describe('restore', () => {
    it('stops writing to files', () => {
      logger.restore();

      console.log('message');

      assertEquals(written.length, 0);
    });
  });
});
