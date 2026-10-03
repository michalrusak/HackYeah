import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const settings = { N: 32_768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const dummyHash = `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, settings, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string | undefined,
): Promise<boolean> {
  const parsed = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(
    storedHash ?? dummyHash,
  );
  if (!parsed?.[1] || !parsed[2]) return false;
  const actual = await derive(password, parsed[1]);
  return timingSafeEqual(actual, Buffer.from(parsed[2], 'hex')) && !!storedHash;
}
