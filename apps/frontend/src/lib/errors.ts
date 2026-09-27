import { isAxiosError } from 'axios';

/**
 * The server explains refusals in plain words ("You already have a product called…");
 * show those as-is. Anything else (no connection, a server fault) gets the fallback.
 * Demo mode throws plain Errors with their own message.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const status = err.response?.status ?? 0;
    const message: unknown = err.response?.data?.message;
    return status >= 400 && status < 500 && typeof message === 'string' && message !== 'Validation failed' ? message : fallback;
  }
  return err instanceof Error && err.message ? err.message : fallback;
}
