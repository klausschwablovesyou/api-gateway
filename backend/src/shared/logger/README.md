# File Logger Service

Automatically logs all `console.*` output to files in addition to displaying in the console.

## Features

- 📝 Writes all console output to log files
- 🕐 Adds timestamps to every log entry
- 📊 Separate error log file for errors
- 📅 Daily log rotation (new file per day)
- 🔄 No code changes needed - patches global console

## Log Files

All logs are stored in the `logs/` directory:

- `app-YYYY-MM-DD.log` - All log levels (log, info, warn, debug, error)
- `error-YYYY-MM-DD.log` - Only errors

## Log Levels

| Method | Console | app.log | error.log |
|--------|---------|---------|-----------|
| `console.log()` | ✅ | ✅ | ❌ |
| `console.info()` | ✅ | ✅ | ❌ |
| `console.warn()` | ✅ | ✅ | ❌ |
| `console.debug()` | ✅ | ✅ | ❌ |
| `console.error()` | ✅ | ✅ | ✅ |

## Log Format

```
[2025-12-06T10:30:45.123Z] [LOG] Server running on http://0.0.0.0:3000
[2025-12-06T10:30:46.456Z] [INFO] Database connected
[2025-12-06T10:30:47.789Z] [ERROR] Failed to connect: Connection refused
```

## Usage

The logger is automatically initialized in `main.ts`. No additional setup required.

All existing `console.log()`, `console.error()`, etc. calls will automatically write to both console and log files.

```typescript
// This will appear in both console and logs/app-YYYY-MM-DD.log
console.log('User logged in');

// This will appear in console, app.log, and error.log
console.error('Database connection failed');
```

## Configuration

To change the log directory, modify the initialization in `main.ts`:

```typescript
const fileLogger = new FileLoggerService('custom-logs-dir');
await fileLogger.initialize();
```

## Log Rotation

- Logs rotate **daily** (new file created each day)
- Old logs are kept automatically
- Manually delete old logs if needed

## Notes

- Objects are automatically JSON stringified
- Circular references are handled gracefully
- Log writes are asynchronous (non-blocking)
- Failed log writes don't crash the application
