/**
 * @fileOverview Structured Logger v1
 * Централизованное логирование для всех операций
 */

import { format } from 'date-fns';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  userId?: string;
  data?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
  };
}

class Logger {
  private isDev = typeof window === 'undefined' ? process.env.NODE_ENV === 'development' : false;

  private formatLog(entry: LogEntry): string {
    return JSON.stringify(entry, null, 2);
  }

  private log(entry: LogEntry) {
    const formattedLog = this.formatLog(entry);

    // В разработке выводим в консоль с цветом
    if (this.isDev) {
      const colors: Record<LogLevel, string> = {
        [LogLevel.DEBUG]: '\x1b[36m', // Cyan
        [LogLevel.INFO]: '\x1b[32m', // Green
        [LogLevel.WARN]: '\x1b[33m', // Yellow
        [LogLevel.ERROR]: '\x1b[31m', // Red
        [LogLevel.CRITICAL]: '\x1b[35m', // Magenta
      };
      const reset = '\x1b[0m';
      console.log(`${colors[entry.level]}${formattedLog}${reset}`);
    } else {
      // В продакшене отправляем на сервер (Firebase Logging)
      this.sendToServer(entry);
    }
  }

  private sendToServer(entry: LogEntry) {
    // TODO: Отправить на Firebase Logging или Sentry
    // fetch('/api/logs', { method: 'POST', body: JSON.stringify(entry) });
  }

  debug(module: string, message: string, data?: Record<string, any>, userId?: string) {
    this.log({
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS'),
      level: LogLevel.DEBUG,
      module,
      message,
      userId,
      data,
    });
  }

  info(module: string, message: string, data?: Record<string, any>, userId?: string) {
    this.log({
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS'),
      level: LogLevel.INFO,
      module,
      message,
      userId,
      data,
    });
  }

  warn(module: string, message: string, data?: Record<string, any>, userId?: string) {
    this.log({
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS'),
      level: LogLevel.WARN,
      module,
      message,
      userId,
      data,
    });
  }

  error(
    module: string,
    message: string,
    error: Error | string,
    data?: Record<string, any>,
    userId?: string
  ) {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    this.log({
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS'),
      level: LogLevel.ERROR,
      module,
      message,
      userId,
      data,
      error: {
        name: errorObj.name,
        message: errorObj.message,
        stack: errorObj.stack,
      },
    });
  }

  critical(
    module: string,
    message: string,
    error: Error | string,
    data?: Record<string, any>,
    userId?: string
  ) {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    this.log({
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS'),
      level: LogLevel.CRITICAL,
      module,
      message,
      userId,
      data,
      error: {
        name: errorObj.name,
        message: errorObj.message,
        code: (errorObj as any).code,
        stack: errorObj.stack,
      },
    });
  }
}

export const logger = new Logger();
