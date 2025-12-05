export type LogLevel = 'INFO' | 'WARNING' | 'ERROR' | 'AUDIT';

export function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  // Basic logger placeholder
  console.log(`[${level}]`, message, context || {});
}
