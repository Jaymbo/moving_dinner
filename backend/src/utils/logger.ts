const isProduction = process.env.NODE_ENV === 'production';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (level === 'debug' && isProduction) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? { context } : {}),
  };

  const output = context
    ? `${entry.timestamp} [${level.toUpperCase()}] ${message}`
    : `${entry.timestamp} [${level.toUpperCase()}] ${message}`;

  switch (level) {
    case 'error':
      console.error(output, context || '');
      break;
    case 'warn':
      console.warn(output, context || '');
      break;
    default:
      console.log(output, context || '');
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => log('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => log('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => log('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => log('error', message, context),
};
