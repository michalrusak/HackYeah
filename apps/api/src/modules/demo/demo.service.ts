import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuthRegisterInputSchema,
  SocialAreaSchema,
  type DemoData,
} from '@repo/api-contracts';
import { timingSafeEqual } from 'node:crypto';
import type { Account } from '../../generated/prisma/client.js';
import { hashPassword } from '../auth/password.js';
import { derivePassword } from '../knowledge/knowledge-auth.service.js';
import { demoAccounts, demoExpertGrant, demoExpertName } from './demo.data.js';
import { DemoRepository } from './demo.repository.js';

/**
 * Tryb demo przygotowuje konta i przykładowe treści oraz udostępnia
 * dane logowania, którymi frontend uzupełnia formularze. Jest domyślnie
 * włączony; przy `DEMO_MODE=false` niczego nie zapisuje ani nie ujawnia.
 */
@Injectable()
export class DemoService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoService.name);
  private current: DemoData = {
    adminPassword: null,
    accounts: [],
    expertGrant: null,
  };

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(DemoRepository) private readonly repository: DemoRepository,
  ) {}

  data(): DemoData {
    return this.current;
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>('DEMO_MODE') === 'false') return;
    const adminPassword = await this.adminPassword();
    const accounts = await this.accounts();
    this.current = {
      adminPassword,
      accounts,
      expertGrant: accounts.length ? demoExpertGrant : null,
    };
    if (adminPassword || accounts.length)
      this.logger.warn(
        'Tryb demo jest włączony: dane logowania kont demo i administratora są publiczne.',
      );
  }

  /** Hasło jest ujawniane tylko wtedy, gdy rzeczywiście otwiera panel. */
  private async adminPassword(): Promise<string | null> {
    const password = this.config.get<string>('DEMO_ADMIN_PASSWORD');
    if (!password) return null;
    const [, salt, encoded] = (
      this.config.get<string>('KNOWLEDGE_ADMIN_PASSWORD_HASH') ?? ''
    ).split(':');
    const expected = Buffer.from(encoded ?? '', 'hex');
    if (salt && expected.length === 64) {
      const key = await derivePassword(password, salt);
      if (timingSafeEqual(key, expected)) return password;
    }
    this.logger.error(
      'DEMO_ADMIN_PASSWORD nie pasuje do KNOWLEDGE_ADMIN_PASSWORD_HASH — hasło administratora nie zostanie podane w formularzu.',
    );
    return null;
  }

  private async accounts(): Promise<DemoData['accounts']> {
    const password = this.config.get<string>('DEMO_ACCOUNT_PASSWORD');
    if (!password) return [];
    if (!AuthRegisterInputSchema.shape.password.safeParse(password).success) {
      this.logger.error(
        'DEMO_ACCOUNT_PASSWORD musi mieć 12–128 znaków — konta demo nie zostały przygotowane.',
      );
      return [];
    }
    const saved = new Map<string, Account>();
    for (const { login, role } of demoAccounts) {
      saved.set(
        role,
        await this.repository.saveAccount(
          login,
          await hashPassword(password),
          role === 'expert'
            ? {
                expertName: demoExpertName,
                expertAreas: [...SocialAreaSchema.options],
              }
            : null,
        ),
      );
    }
    const tester = saved.get('tester');
    const organizer = saved.get('organizer');
    if (tester && organizer)
      await this.repository.ensureContent(tester, organizer);
    return demoAccounts.map(({ login, role }) => ({ login, password, role }));
  }
}
