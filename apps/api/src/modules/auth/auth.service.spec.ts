import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import type { Account } from '../../generated/prisma/client.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService, credentialHash } from './auth.service.js';
import { hashPassword } from './password.js';

describe('AuthService', () => {
  const repository = {
    findByLogin: vi.fn<AuthRepository['findByLogin']>(),
    findByOwner: vi.fn<AuthRepository['findByOwner']>(),
    createAccount: vi.fn<AuthRepository['createAccount']>(),
    createSession: vi.fn<AuthRepository['createSession']>(),
    findSession: vi.fn<AuthRepository['findSession']>(),
    deleteSession: vi.fn<AuthRepository['deleteSession']>(),
  };
  let service: AuthService;
  let account: Account;

  beforeAll(async () => {
    account = {
      id: 'd83bde56-215b-4566-9ebc-72c68b9a4f13',
      login: 'test.user',
      passwordHash: await hashPassword('Test-password-123!'),
      ownerHash: 'a'.repeat(64),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    repository.findByLogin.mockResolvedValue(account);
    repository.findByOwner.mockResolvedValue(null);
    const module = await Test.createTestingModule({
      providers: [AuthService, { provide: AuthRepository, useValue: repository }],
    }).compile();
    service = module.get(AuthService);
  });

  it('stores only the hash of a freshly generated session credential', async () => {
    const result = await service.login({ login: 'test.user', password: 'Test-password-123!' });
    expect(result.user).toEqual({ id: account.id, login: account.login });
    expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    expect(repository.createSession).toHaveBeenCalledWith(expect.objectContaining({
      accountId: account.id,
      tokenHash: credentialHash(result.token),
    }));
    expect(JSON.stringify(repository.createSession.mock.calls)).not.toContain(result.token);
  });

  it('rejects expired sessions and removes their credential', async () => {
    const token = 'b'.repeat(64);
    const tokenHash = credentialHash(token);
    repository.findSession.mockResolvedValue({
      id: 'session-id', tokenHash, accountId: account.id,
      createdAt: new Date(), expiresAt: new Date(Date.now() - 1), account,
    });
    expect(await service.accountForToken(token)).toBeNull();
    expect(repository.deleteSession).toHaveBeenCalledWith(tokenHash);
  });

  it('rejects incorrect passwords and unknown users with the same response', async () => {
    let wrongPassword: unknown;
    try {
      await service.login({ login: 'test.user', password: 'Wrong-password-123!' });
    } catch (error) { wrongPassword = error; }
    repository.findByLogin.mockResolvedValue(null);
    let unknownUser: unknown;
    try {
      await service.login({ login: 'missing', password: 'Wrong-password-123!' });
    } catch (error) { unknownUser = error; }
    expect(wrongPassword).toBeInstanceOf(UnauthorizedException);
    expect(unknownUser).toBeInstanceOf(UnauthorizedException);
    if (wrongPassword instanceof UnauthorizedException && unknownUser instanceof UnauthorizedException) {
      expect(wrongPassword.getResponse()).toEqual(unknownUser.getResponse());
    }
    expect(repository.createSession).not.toHaveBeenCalled();
  });
});
