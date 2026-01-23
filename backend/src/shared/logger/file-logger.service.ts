import { ensureDir } from 'jsr:@std/fs';
import { LogEntry } from '@shared/types/log-entry';
import { LogLevel } from '@shared/types/log-level';
import { RealtimeTopic } from '@shared/types/realtime-topic';
import { UserRole } from '@shared/types/user-role';

interface RealtimeServiceInterface {
  notifyByRole(role: UserRole, topic: RealtimeTopic, data: any): void;
}

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
  private _realtimeService: RealtimeServiceInterface | null = null;
  private _logBuffer: LogEntry[] = [];
  private readonly MAX_BUFFER_SIZE = 100;

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

  public setRealtimeService(realtimeService: RealtimeServiceInterface): void {
    this._realtimeService = realtimeService;
  }

  public getLogBuffer(): LogEntry[] {
    return [...this._logBuffer];
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
      this.broadcastLog(LogLevel.LOG, args);
    };

    console.error = (...args: any[]) => {
      this.originalConsole.error(...args);
      this.writeToFile(this.errorLogFilePath, 'ERROR', args);
      this.writeToFile(this.logFilePath, 'ERROR', args);
      this.broadcastLog(LogLevel.ERROR, args);
    };

    console.warn = (...args: any[]) => {
      this.originalConsole.warn(...args);
      this.writeToFile(this.logFilePath, 'WARN', args);
      this.broadcastLog(LogLevel.WARN, args);
    };

    console.info = (...args: any[]) => {
      this.originalConsole.info(...args);
      this.writeToFile(this.logFilePath, 'INFO', args);
      this.broadcastLog(LogLevel.INFO, args);
    };

    console.debug = (...args: any[]) => {
      this.originalConsole.debug(...args);
      this.writeToFile(this.logFilePath, 'DEBUG', args);
      this.broadcastLog(LogLevel.DEBUG, args);
    };
  }

  /**
   * Broadcasts a log entry to SuperAdmin users via realtime service
   */
  private broadcastLog(level: LogLevel, args: any[]): void {
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

    const logEntry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    // Add to buffer (keep most recent entries)
    this._logBuffer.push(logEntry);
    if (this._logBuffer.length > this.MAX_BUFFER_SIZE) {
      this._logBuffer.shift();
    }

    // Broadcast to SuperAdmin users if realtime service is available
    if (this._realtimeService) {
      this._realtimeService.notifyByRole(UserRole.SuperAdmin, RealtimeTopic.ConsoleLog, logEntry);
    }
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
