import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const MODULE_PATH = require.resolve('./jwtSecret');

function loadFresh() {
  delete require.cache[MODULE_PATH];
  return require('./jwtSecret');
}

describe('jwtSecret', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.JWT_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    delete require.cache[MODULE_PATH];
  });

  it('falls back to the dev default when JWT_SECRET is unset outside production', () => {
    expect(loadFresh()).toBe('juz40_secret_key');
  });

  it('uses the real secret in production when JWT_SECRET is set', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a-real-random-secret';
    expect(loadFresh()).toBe('a-real-random-secret');
  });

  it('throws instead of silently using the fallback in production without JWT_SECRET', () => {
    process.env.NODE_ENV = 'production';
    expect(loadFresh).toThrow(/JWT_SECRET/);
  });
});
