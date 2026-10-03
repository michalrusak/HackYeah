import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Zamiast kont użytkowników każdy zasób tworzony anonimowo dostaje własny
 * sekret. Token wraca w odpowiedzi dokładnie raz, w bazie zostaje tylko jego
 * skrót — model danych jest więc gotowy na podmianę tej warstwy na logowanie.
 */
export interface EditToken {
  token: string;
  hash: string;
}

export function createEditToken(): EditToken {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashEditToken(token) };
}

export function hashEditToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function matchesEditToken(
  token: string | undefined,
  expectedHash: string,
): boolean {
  if (!token) return false;
  const provided = Buffer.from(hashEditToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
