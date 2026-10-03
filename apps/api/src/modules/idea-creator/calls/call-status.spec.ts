import { describe, expect, it } from 'vitest';
import { findNextOpening, isOpen, resolveCallStatus } from './call-status.js';

const opensAt = new Date('2026-03-01T00:00:00.000Z');
const closesAt = new Date('2026-03-31T23:59:59.000Z');

describe('resolveCallStatus', () => {
  it('oznacza nabór przed otwarciem jako upcoming', () => {
    const now = new Date('2026-02-20T12:00:00.000Z');
    expect(resolveCallStatus(now, opensAt, closesAt)).toBe('upcoming');
  });

  it('oznacza nabór w oknie jako open', () => {
    const now = new Date('2026-03-15T12:00:00.000Z');
    expect(resolveCallStatus(now, opensAt, closesAt)).toBe('open');
    expect(isOpen(now, opensAt, closesAt)).toBe(true);
  });

  it('oznacza nabór po terminie jako closed', () => {
    const now = new Date('2026-04-01T12:00:00.000Z');
    expect(resolveCallStatus(now, opensAt, closesAt)).toBe('closed');
    expect(isOpen(now, opensAt, closesAt)).toBe(false);
  });

  it('traktuje moment otwarcia i zamknięcia jako część naboru', () => {
    expect(resolveCallStatus(opensAt, opensAt, closesAt)).toBe('open');
    expect(resolveCallStatus(closesAt, opensAt, closesAt)).toBe('open');
  });
});

describe('findNextOpening', () => {
  it('zwraca najbliższe otwarcie z przyszłości', () => {
    const now = new Date('2026-02-01T00:00:00.000Z');
    const result = findNextOpening(now, [
      { opensAt: new Date('2026-06-01T00:00:00.000Z') },
      { opensAt: new Date('2026-03-01T00:00:00.000Z') },
      { opensAt: new Date('2025-01-01T00:00:00.000Z') },
    ]);
    expect(result?.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('zwraca null, gdy wszystkie nabory już się rozpoczęły', () => {
    const now = new Date('2026-07-01T00:00:00.000Z');
    expect(
      findNextOpening(now, [{ opensAt: new Date('2026-03-01T00:00:00.000Z') }]),
    ).toBeNull();
  });
});
