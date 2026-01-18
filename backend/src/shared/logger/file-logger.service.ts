import { ensureDir } from 'jsr:@std/fs';

export class FileLoggerService {
  private logFilePath: string;
  private errorLogFilePath: string;
  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
    debug: typeof console.debug;
  };

  constructor(logsDir = 'logs') {
    const today = new Date().toISOString().split('T')[0];
    this.logFilePath = `${logsDir}/app-${today}.log`;
    this.errorLogFilePath = `${logsDir}/error-${today}.log`;

    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console),
      debug: console.debug.bind(console),
    };
  }

  /**
   * Initializes the file logger and patches console methods
   */
  public async initialize(): Promise<void> {
    await ensureDir('logs');
    this.patchConsoleMethods();
    console.log('[FileLogger] File logging initialized');
    console.log(`[FileLogger] Logs: ${this.logFilePath}`);
    console.log(`[FileLogger] Errors: ${this.errorLogFilePath}`);
  }

  /**
   * Patches global console methods to also write to files
   */
  private patchConsoleMethods(): void {
    console.log = (...args: any[]) => {
      this.originalConsole.log(...args);
      this.writeToFile(this.logFilePath, 'LOG', args);
    };

    console.error = (...args: any[]) => {
      this.originalConsole.error(...args);
      this.writeToFile(this.errorLogFilePath, 'ERROR', args);
      this.writeToFile(this.logFilePath, 'ERROR', args);
    };

    console.warn = (...args: any[]) => {
      this.originalConsole.warn(...args);
      this.writeToFile(this.logFilePath, 'WARN', args);
    };

    console.info = (...args: any[]) => {
      this.originalConsole.info(...args);
      this.writeToFile(this.logFilePath, 'INFO', args);
    };

    console.debug = (...args: any[]) => {
      this.originalConsole.debug(...args);
      this.writeToFile(this.logFilePath, 'DEBUG', args);
    };
  }

  /**
   * Writes a log entry to a file
   */
  private async writeToFile(
    filePath: string,
    level: string,
    args: any[],
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const message = args
        .map((arg) => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(' ');

      const logEntry = `[${timestamp}] [${level}] ${message}\n`;

      await Deno.writeTextFile(filePath, logEntry, { append: true });
    } catch (error) {
      this.originalConsole.error('[FileLogger] Failed to write to log file:', error);
    }
  }

  /**
   * Restores original console methods
   */
  public restore(): void {
    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;
    console.debug = this.originalConsole.debug;
  }
}
