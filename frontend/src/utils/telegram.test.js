import { describe, it, expect, afterEach } from 'vitest';
import { isTelegramWebApp, getTelegramInitData } from './telegram';

afterEach(() => {
  delete window.Telegram;
});

describe('isTelegramWebApp', () => {
  it('is false in a plain browser (no window.Telegram)', () => {
    expect(isTelegramWebApp()).toBe(false);
  });

  it('is false when window.Telegram.WebApp.initData is empty', () => {
    window.Telegram = { WebApp: { initData: '' } };
    expect(isTelegramWebApp()).toBe(false);
  });

  it('is true when opened inside Telegram with real initData', () => {
    window.Telegram = { WebApp: { initData: 'user=%7B%22id%22%3A1%7D&hash=abc' } };
    expect(isTelegramWebApp()).toBe(true);
  });
});

describe('getTelegramInitData', () => {
  it('returns an empty string outside Telegram', () => {
    expect(getTelegramInitData()).toBe('');
  });

  it('returns the raw initData string when present', () => {
    window.Telegram = { WebApp: { initData: 'auth_date=123&hash=abc' } };
    expect(getTelegramInitData()).toBe('auth_date=123&hash=abc');
  });
});
