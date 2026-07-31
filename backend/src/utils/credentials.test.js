import { describe, it, expect } from 'vitest';
const { translit, makeUsername, makePassword, hashPassword } = require('./credentials');

describe('translit', () => {
  it('converts Kazakh Cyrillic letters not present in Russian', () => {
    expect(translit('әқңөұүһі')).toBe('aqngouuhi');
  });

  it('converts a real full name into a dot-separated slug', () => {
    expect(translit('Орынбек Меруерт')).toBe('orynbek.meruert');
  });

  it('strips leading/trailing separators produced by punctuation', () => {
    expect(translit('  Меруерт!!')).toBe('meruert');
  });

  it('lowercases and preserves plain latin/digits untouched', () => {
    expect(translit('Talgat123')).toBe('talgat123');
  });
});

describe('makeUsername', () => {
  it('returns the translit base when the username is free', async () => {
    const pool = { query: async () => ({ rows: [] }) };
    const username = await makeUsername('Талғатұлы Таңат', pool);
    expect(username).toBe('talgatuly.tangat');
  });

  it('appends an incrementing number on collision until a free one is found', async () => {
    const taken = new Set(['meruert', 'meruert2', 'meruert3']);
    const pool = {
      query: async (_sql, [candidate]) => ({ rows: taken.has(candidate) ? [{ id: 1 }] : [] }),
    };
    const username = await makeUsername('Меруерт', pool);
    expect(username).toBe('meruert4');
  });

  it('falls back to "curator" when the name translit-erates to nothing', async () => {
    const pool = { query: async () => ({ rows: [] }) };
    const username = await makeUsername('!!!', pool);
    expect(username).toBe('curator');
  });
});

describe('makePassword', () => {
  it('defaults to 8 characters', () => {
    expect(makePassword()).toHaveLength(8);
  });

  it('respects a custom length', () => {
    expect(makePassword(12)).toHaveLength(12);
  });

  it('never includes visually-ambiguous characters (0, O, 1, l)', () => {
    const password = makePassword(500);
    expect(password).not.toMatch(/[0O1l]/);
  });
});

describe('hashPassword', () => {
  it('produces a bcrypt hash that verifies against the original password', async () => {
    const bcrypt = require('bcryptjs');
    const hash = await hashPassword('x7k2m9pq');
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(await bcrypt.compare('x7k2m9pq', hash)).toBe(true);
    expect(await bcrypt.compare('wrong-password', hash)).toBe(false);
  });
});
