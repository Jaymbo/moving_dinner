import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger.js';

describe('logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs info messages with a timestamp and level', () => {
    logger.info('hello world');
    expect(consoleLogSpy).toHaveBeenCalledOnce();
    expect(consoleLogSpy.mock.calls[0][0]).toMatch(/\[INFO\] hello world/);
  });

  it('logs error messages', () => {
    logger.error('something went wrong', { detail: 'boom' });
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy.mock.calls[0][0]).toMatch(/\[ERROR\] something went wrong/);
  });

  it('logs warning messages', () => {
    logger.warn('be careful');
    expect(consoleWarnSpy).toHaveBeenCalledOnce();
    expect(consoleWarnSpy.mock.calls[0][0]).toMatch(/\[WARN\] be careful/);
  });
});
