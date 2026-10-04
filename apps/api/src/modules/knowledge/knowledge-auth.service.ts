import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { ErrorCodes, type AdminSession } from '@repo/api-contracts';
import { KnowledgeRepository } from './knowledge.repository.js';

const COOKIE = 'knowledge_admin';
const PATH = '/api/knowledge/admin';
export function sessionHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
export function derivePassword(
  password: string,
  salt: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
function deny(): never {
  throw new UnauthorizedException({
    success: false,
    error: {
      code: ErrorCodes.UNAUTHORIZED,
      message: 'Zaloguj się jako administrator.',
    },
  });
}

@Injectable()
export class KnowledgeAuthService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(KnowledgeRepository)
    private readonly repository: KnowledgeRepository,
  ) {}

  checkOrigin(request: Request): void {
    const allowed =
      this.config.get<string>('WEB_ORIGIN') ??
      `http://localhost:${this.config.get<string>('WEB_PORT') ?? '4200'}`;
    if (request.headers.origin !== allowed) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: ErrorCodes.FORBIDDEN,
          message: 'Nieprawidłowe źródło żądania.',
        },
      });
    }
  }

  async login(password: string, response: Response): Promise<AdminSession> {
    const hash = this.config.get<string>('KNOWLEDGE_ADMIN_PASSWORD_HASH');
    if (!hash || !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash)) {
      throw new ServiceUnavailableException({
        success: false,
        error: {
          code: ErrorCodes.ADMIN_NOT_CONFIGURED,
          message: 'Administrator nie został skonfigurowany.',
        },
      });
    }
    const [, salt, encoded] = hash.split(':');
    const key = await derivePassword(password, salt);
    if (!timingSafeEqual(key, Buffer.from(encoded, 'hex'))) deny();
    const token = randomBytes(32).toString('hex');
    const csrfToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await this.repository.createSession(
      sessionHash(token),
      csrfToken,
      expiresAt,
      sessionHash(hash),
    );
    response.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      path: PATH,
      maxAge: 8 * 60 * 60 * 1000,
    });
    return { csrfToken, expiresAt: expiresAt.toISOString() };
  }

  async authenticate(
    request: Request,
  ): Promise<{ id: string; session: AdminSession }> {
    const token = request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(COOKIE + '='))
      ?.slice(COOKIE.length + 1);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) deny();
    const id = sessionHash(token);
    const row = await this.repository.session(id);
    if (
      !row ||
      row.credentialVersion !==
        sessionHash(
          this.config.get<string>('KNOWLEDGE_ADMIN_PASSWORD_HASH') ?? '',
        )
    )
      deny();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      this.checkOrigin(request);
      const csrf = request.headers['x-knowledge-csrf'];
      if (
        typeof csrf !== 'string' ||
        !/^[a-f0-9]{64}$/.test(csrf) ||
        !timingSafeEqual(Buffer.from(csrf), Buffer.from(row.csrfToken))
      ) {
        throw new ForbiddenException({
          success: false,
          error: {
            code: ErrorCodes.FORBIDDEN,
            message: 'Sesja nie pozwala na zapis. Zaloguj się ponownie.',
          },
        });
      }
    }
    return {
      id,
      session: {
        csrfToken: row.csrfToken,
        expiresAt: row.expiresAt.toISOString(),
      },
    };
  }

  async logout(id: string, response: Response): Promise<void> {
    await this.repository.removeSession(id);
    response.clearCookie(COOKIE, {
      path: PATH,
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.get<string>('NODE_ENV') === 'production',
    });
  }
}
