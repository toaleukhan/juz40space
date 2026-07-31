import { describe, it, expect, vi } from 'vitest';
const { retryGoogleApi, isRetryableGoogleError } = require('./retryGoogleApi');

function makeError(overrides) {
  return Object.assign(new Error('boom'), overrides);
}

describe('isRetryableGoogleError', () => {
  it('treats 429 as retryable', () => {
    expect(isRetryableGoogleError(makeError({ code: 429 }))).toBe(true);
  });

  it('treats 5xx as retryable', () => {
    expect(isRetryableGoogleError(makeError({ code: 503 }))).toBe(true);
  });

  it('treats a 403 with a rate-limit reason as retryable', () => {
    expect(isRetryableGoogleError(makeError({
      code: 403,
      errors: [{ reason: 'rateLimitExceeded' }],
    }))).toBe(true);
  });

  it('does not retry a plain permission-denied 403', () => {
    expect(isRetryableGoogleError(makeError({
      code: 403,
      errors: [{ reason: 'forbidden' }],
      message: 'Insufficient permission',
    }))).toBe(false);
  });

  it('does not retry a 400 (bad request)', () => {
    expect(isRetryableGoogleError(makeError({ code: 400 }))).toBe(false);
  });
});

describe('retryGoogleApi', () => {
  it('returns the result immediately on success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryGoogleApi(fn, { retries: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on a retryable error and eventually succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(makeError({ code: 429 }))
      .mockRejectedValueOnce(makeError({ code: 429 }))
      .mockResolvedValue('ok');
    const result = await retryGoogleApi(fn, { retries: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('gives up and throws after exhausting retries', async () => {
    const fn = vi.fn().mockRejectedValue(makeError({ code: 429 }));
    await expect(retryGoogleApi(fn, { retries: 2, baseDelayMs: 1 })).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('does not retry a non-retryable error, fails immediately', async () => {
    const fn = vi.fn().mockRejectedValue(makeError({ code: 400 }));
    await expect(retryGoogleApi(fn, { retries: 3, baseDelayMs: 1 })).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
