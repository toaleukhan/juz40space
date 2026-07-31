import { describe, it, expect } from 'vitest';
const jwt = require('jsonwebtoken');
const JWT_SECRET = require('../config/jwtSecret');
const { authenticatedUserKey } = require('./security');

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET);
}

describe('authenticatedUserKey', () => {
  it('returns null when there is no token at all', () => {
    expect(authenticatedUserKey({ headers: {}, query: {} })).toBeNull();
  });

  it('extracts the user id from a valid Bearer token', () => {
    const token = makeToken({ id: 42 });
    const req = { headers: { authorization: `Bearer ${token}` }, query: {} };
    expect(authenticatedUserKey(req)).toBe('42');
  });

  it('extracts the user id from a ?token= query param (same fallback auth.js uses)', () => {
    const token = makeToken({ id: 7 });
    const req = { headers: {}, query: { token } };
    expect(authenticatedUserKey(req)).toBe('7');
  });

  it('returns null for a malformed/invalid token instead of throwing', () => {
    const req = { headers: { authorization: 'Bearer not-a-real-token' }, query: {} };
    expect(authenticatedUserKey(req)).toBeNull();
  });

  it('returns null for a token signed with a different secret', () => {
    const foreignToken = jwt.sign({ id: 1 }, 'some-other-secret');
    const req = { headers: { authorization: `Bearer ${foreignToken}` }, query: {} };
    expect(authenticatedUserKey(req)).toBeNull();
  });

  it('gives two different users two different keys', () => {
    const reqA = { headers: { authorization: `Bearer ${makeToken({ id: 1 })}` }, query: {} };
    const reqB = { headers: { authorization: `Bearer ${makeToken({ id: 2 })}` }, query: {} };
    expect(authenticatedUserKey(reqA)).not.toBe(authenticatedUserKey(reqB));
  });
});
