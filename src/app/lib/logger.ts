/**
 * @fileOverview Структурированный логгер для серверной части.
 * Интегрирован с Cloud Logging через process.stdout.
 */

export const logger = {
  info: (message: string, context?: any) => {
    const logEntry = JSON.stringify({ 
      level: 'info', 
      message, 
      ...context, 
      timestamp: new Date().toISOString() 
    });
    process.stdout.write(logEntry + '\n');
  },
  warn: (message: string, context?: any) => {
    const logEntry = JSON.stringify({ 
      level: 'warn', 
      message, 
      ...context, 
      timestamp: new Date().toISOString() 
    });
    process.stdout.write(logEntry + '\n');
  },
  error: (message: string, error?: any, context?: any) => {
    const logEntry = JSON.stringify({ 
      level: 'error', 
      message, 
      error: error?.message || error, 
      stack: error?.stack,
      ...context, 
      timestamp: new Date().toISOString() 
    });
    process.stdout.write(logEntry + '\n');
  }
};
