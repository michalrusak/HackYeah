import { describe, expect, it } from 'vitest';
import { createEditToken, hashEditToken, matchesEditToken } from './edit-token.js';

describe('edit-token', () => {
  it('nie zapisuje tokenu w postaci jawnej', () => {
    const { token, hash } = createEditToken();
    expect(hash).not.toContain(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('akceptuje wyłącznie właściwy token', () => {
    const { token, hash } = createEditToken();
    expect(matchesEditToken(token, hash)).toBe(true);
    expect(matchesEditToken(`${token}x`, hash)).toBe(false);
    expect(matchesEditToken(createEditToken().token, hash)).toBe(false);
  });

  it('odrzuca brak tokenu i skrót o nieprawidłowej długości', () => {
    const { token, hash } = createEditToken();
    expect(matchesEditToken(undefined, hash)).toBe(false);
    expect(matchesEditToken(token, 'abc')).toBe(false);
  });

  it('generuje różne tokeny przy każdym wywołaniu', () => {
    const first = createEditToken();
    const second = createEditToken();
    expect(first.token).not.toBe(second.token);
    expect(hashEditToken(first.token)).toBe(first.hash);
  });
});
