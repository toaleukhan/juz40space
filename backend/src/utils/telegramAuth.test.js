import { describe, it, expect } from 'vitest';
const crypto = require('crypto');
const { verifyInitData } = require('./telegramAuth');

const BOT_TOKEN = '123456:test-bot-token';

// Telegram-мен бірдей алгоритммен өзіміз дұрыс қолтаңбаланған initData
// құрастырамыз — нақты ботсыз да verifyInitData дәл сол алгоритмді дұрыс
// іске асырғанын тексереміз.
function signInitData(fields, botToken = BOT_TOKEN) {
  const pairs = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort();
  const dataCheckString = pairs.join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

function baseFields(overrides = {}) {
  return {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAHtest',
    user: JSON.stringify({ id: 987654321, first_name: 'Талғат', last_name: 'Тестов', username: 'talgat_test' }),
    ...overrides,
  };
}

describe('verifyInitData', () => {
  it('accepts correctly-signed data and returns the parsed user', () => {
    const initData = signInitData(baseFields());
    const user = verifyInitData(initData, BOT_TOKEN);
    expect(user).toEqual({ id: 987654321, firstName: 'Талғат', lastName: 'Тестов', username: 'talgat_test' });
  });

  it('rejects data signed with a different bot token', () => {
    const initData = signInitData(baseFields(), 'wrong-token');
    expect(() => verifyInitData(initData, BOT_TOKEN)).toThrow(/қолтаңба/);
  });

  it('rejects tampered fields (e.g. a swapped user id) even if hash format is valid', () => {
    const initData = signInitData(baseFields());
    const params = new URLSearchParams(initData);
    params.set('user', JSON.stringify({ id: 111, first_name: 'Бөтен' }));
    expect(() => verifyInitData(params.toString(), BOT_TOKEN)).toThrow(/қолтаңба/);
  });

  it('rejects a missing hash', () => {
    const params = new URLSearchParams(baseFields());
    expect(() => verifyInitData(params.toString(), BOT_TOKEN)).toThrow(/hash/);
  });

  it('rejects expired initData (auth_date older than maxAgeSeconds)', () => {
    const oldAuthDate = String(Math.floor(Date.now() / 1000) - 2 * 86400);
    const initData = signInitData(baseFields({ auth_date: oldAuthDate }));
    expect(() => verifyInitData(initData, BOT_TOKEN)).toThrow(/мерзімі/);
  });

  it('accepts data just within the freshness window', () => {
    const recentAuthDate = String(Math.floor(Date.now() / 1000) - 60);
    const initData = signInitData(baseFields({ auth_date: recentAuthDate }));
    expect(() => verifyInitData(initData, BOT_TOKEN)).not.toThrow();
  });

  it('throws when TELEGRAM_BOT_TOKEN is not configured', () => {
    const initData = signInitData(baseFields());
    expect(() => verifyInitData(initData, undefined)).toThrow(/TELEGRAM_BOT_TOKEN/);
  });

  it('throws on empty initData', () => {
    expect(() => verifyInitData('', BOT_TOKEN)).toThrow(/initData/);
  });
});
