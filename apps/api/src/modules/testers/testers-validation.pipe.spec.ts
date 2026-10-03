import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { TesterOwnerKeyPipe } from './testers-validation.pipe.js';

describe('TesterOwnerKeyPipe', () => {
  const pipe = new TesterOwnerKeyPipe();
  it.each([
    undefined,
    '',
    'a'.repeat(63),
    'A'.repeat(64),
    'z'.repeat(64),
    ['a'.repeat(64)],
  ])('rejects invalid access key', (key) => {
    expect(() => pipe.transform(key)).toThrow(UnauthorizedException);
  });

  it('uses only the SHA256 hash as the database owner identifier', () => {
    const key = 'ab'.repeat(32);
    expect(pipe.transform(key)).toBe(
      createHash('sha256').update(key).digest('hex'),
    );
    expect(pipe.transform(key)).not.toBe(key);
  });
});
