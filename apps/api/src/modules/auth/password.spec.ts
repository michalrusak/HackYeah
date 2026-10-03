import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('uses independent salts and accepts only the unchanged password', async () => {
    const password = 'Hasło z odstępami 123!';
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword(`${password} `, first)).toBe(false);
  });

  it('rejects absent credentials and invalid stored hashes', async () => {
    expect(await verifyPassword('Anything-123!', undefined)).toBe(false);
    expect(await verifyPassword('Anything-123!', 'invalid')).toBe(false);
  });
});
