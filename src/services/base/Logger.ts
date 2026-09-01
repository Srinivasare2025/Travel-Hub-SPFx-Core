import { Log } from '@microsoft/sp-core-library';

/**
 * Thin wrapper over the SPFx logging API. Log errors and warnings with context
 * (operation, list) — never response bodies, PII, or tokens (SECURITY.md §6).
 * No `console.*` in shipped code.
 */
export class Logger {
  public constructor(private readonly source: string) {}

  public info(message: string): void {
    Log.info(this.source, message);
  }

  public warn(message: string): void {
    Log.warn(this.source, message);
  }

  public error(message: string, error?: unknown): void {
    const err = error instanceof Error ? error : new Error(safeMessage(error));
    Log.error(this.source, err);
    Log.warn(this.source, message);
  }

  /** Child logger with a nested source label. */
  public child(scope: string): Logger {
    return new Logger(`${this.source}:${scope}`);
  }
}

function safeMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error !== null && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Unknown error';
}
