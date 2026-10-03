import type { CallStatus } from '@repo/api-contracts';

/**
 * „Czasowa dostępność” generatora wniosków z briefu wynika wyłącznie z okna
 * naboru, dlatego status jest liczony, a nie przechowywany w bazie.
 */
export function resolveCallStatus(
  now: Date,
  opensAt: Date,
  closesAt: Date,
): CallStatus {
  if (now < opensAt) return 'upcoming';
  if (now > closesAt) return 'closed';
  return 'open';
}

export function isOpen(now: Date, opensAt: Date, closesAt: Date): boolean {
  return resolveCallStatus(now, opensAt, closesAt) === 'open';
}

/** Najbliższe otwarcie — UI pokazuje je, gdy żaden nabór nie trwa. */
export function findNextOpening(
  now: Date,
  calls: readonly { opensAt: Date }[],
): Date | null {
  const upcoming = calls
    .map((call) => call.opensAt)
    .filter((date) => date > now)
    .sort((a, b) => a.getTime() - b.getTime());
  return upcoming[0] ?? null;
}
