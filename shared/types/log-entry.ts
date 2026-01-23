import { LogLevel } from '@shared/types/log-level';

export type LogEntry = {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  source?: string;
}
