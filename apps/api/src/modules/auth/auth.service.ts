import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { ErrorCodes, type AuthLoginInput, type AuthRegisterInput, type AuthUser } from '@repo/api-contracts';
import { Prisma, type Account } from '../../generated/prisma/client.js';
import { AuthRepository } from './auth.repository.js';
import { hashPassword, verifyPassword } from './password.js';

export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function credentialHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function publicUser(account: Account): AuthUser {
  return { id: account.id, login: account.login };
}

@Injectable()
export class AuthService {
  constructor(@Inject(AuthRepository) private readonly repository: AuthRepository) {}

  async register(input: AuthRegisterInput): Promise<{ user: AuthUser; token: string }> {
    const ownerHash = input.legacyKey
      ? credentialHash(input.legacyKey)
      : randomBytes(32).toString('hex');
    const login = input.login.toLowerCase();
    if (await this.repository.findByLogin(login) || await this.repository.findByOwner(ownerHash)) {
      throw this.registrationConflict();
    }
    const passwordHash = await hashPassword(input.password);
    try {
      const account = await this.repository.createAccount({ login, ownerHash, passwordHash });
      return this.newSession(account);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw this.registrationConflict();
      }
      throw error;
    }
  }

  async login(input: AuthLoginInput): Promise<{ user: AuthUser; token: string }> {
    const account = await this.repository.findByLogin(input.login.toLowerCase());
    const valid = await verifyPassword(input.password, account?.passwordHash);
    if (!account || !valid) {
      throw new UnauthorizedException({
        success: false,
        error: { code: ErrorCodes.UNAUTHORIZED, message: 'Nieprawidłowy login lub hasło.' },
      });
    }
    return this.newSession(account);
  }

  async accountForToken(token: string | undefined): Promise<Account | null> {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const session = await this.repository.findSession(credentialHash(token));
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.repository.deleteSession(session.tokenHash);
      return null;
    }
    return session.account;
  }

  async logout(token: string | undefined): Promise<void> {
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      await this.repository.deleteSession(credentialHash(token));
    }
  }

  async isClaimedOwner(ownerHash: string): Promise<boolean> {
    return !!await this.repository.findByOwner(ownerHash);
  }

  private async newSession(account: Account): Promise<{ user: AuthUser; token: string }> {
    const token = randomBytes(32).toString('hex');
    await this.repository.createSession({
      accountId: account.id,
      tokenHash: credentialHash(token),
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    });
    return { user: publicUser(account), token };
  }

  private registrationConflict(): ConflictException {
    return new ConflictException({
      success: false,
      error: { code: ErrorCodes.CONFLICT, message: 'Login jest zajęty lub ten profil ma już konto. Zaloguj się albo wybierz inny login.' },
    });
  }
}
