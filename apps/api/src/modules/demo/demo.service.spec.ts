import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { scryptSync } from 'node:crypto';
import type { Account } from '../../generated/prisma/client.js';
import { verifyPassword } from '../auth/password.js';
import { DemoRepository } from './demo.repository.js';
import { DemoService } from './demo.service.js';

const adminPassword = 'Synthetic admin password';
const accountPassword = 'Synthetic demo password';
const salt = 'ab'.repeat(16);
const adminHash = `scrypt:${salt}:${scryptSync(adminPassword, salt, 64).toString('hex')}`;
const empty = { adminPassword: null, accounts: [], expertGrant: null };

describe('DemoService', () => {
  const repository = {
    saveAccount: vi.fn<DemoRepository['saveAccount']>(),
    ensureContent: vi.fn<DemoRepository['ensureContent']>(),
  };

  async function start(env: Record<string, string>): Promise<DemoService> {
    const module = await Test.createTestingModule({
      providers: [
        DemoService,
        { provide: DemoRepository, useValue: repository },
        { provide: ConfigService, useValue: new ConfigService(env) },
      ],
    }).compile();
    const service = module.get(DemoService);
    await service.onApplicationBootstrap();
    return service;
  }

  beforeEach(() => {
    vi.resetAllMocks();
    repository.saveAccount.mockImplementation(
      async (login) => ({ login }) as Account,
    );
  });

  it('reveals nothing and writes nothing when demo mode is switched off', async () => {
    const service = await start({
      DEMO_MODE: 'false',
      DEMO_ADMIN_PASSWORD: adminPassword,
      DEMO_ACCOUNT_PASSWORD: accountPassword,
      KNOWLEDGE_ADMIN_PASSWORD_HASH: adminHash,
    });
    expect(service.data()).toEqual(empty);
    expect(repository.saveAccount).not.toHaveBeenCalled();
  });

  it('prepares demo accounts and exposes working credentials by default', async () => {
    const service = await start({
      DEMO_ADMIN_PASSWORD: adminPassword,
      DEMO_ACCOUNT_PASSWORD: accountPassword,
      KNOWLEDGE_ADMIN_PASSWORD_HASH: adminHash,
    });
    expect(service.data()).toEqual({
      adminPassword,
      accounts: [
        { login: 'demo-tester', password: accountPassword, role: 'tester' },
        {
          login: 'demo-organizator',
          password: accountPassword,
          role: 'organizer',
        },
        { login: 'demo-ekspert', password: accountPassword, role: 'expert' },
      ],
      expertGrant: {
        login: 'demo-organizator',
        name: 'Drugi ekspert demonstracyjny',
        areas: ['Seniorzy', 'Zdrowie psychiczne'],
      },
    });
    const [login, hash, expert] = repository.saveAccount.mock.calls[2] ?? [];
    expect(login).toBe('demo-ekspert');
    expect(await verifyPassword(accountPassword, hash)).toBe(true);
    expect(expert?.expertAreas).toHaveLength(8);
    expect(repository.saveAccount.mock.calls[0]?.[2]).toBeNull();
    expect(repository.ensureContent).toHaveBeenCalledWith(
      { login: 'demo-tester' },
      { login: 'demo-organizator' },
    );
  });

  it('hides credentials that would not work', async () => {
    const service = await start({
      DEMO_ADMIN_PASSWORD: 'a different password',
      DEMO_ACCOUNT_PASSWORD: 'too short',
      KNOWLEDGE_ADMIN_PASSWORD_HASH: adminHash,
    });
    expect(service.data()).toEqual(empty);
    expect(repository.saveAccount).not.toHaveBeenCalled();
  });
});
