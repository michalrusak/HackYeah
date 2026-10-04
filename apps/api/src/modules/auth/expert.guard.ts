import {
  createParamDecorator,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ErrorCodes, type AuthExpert } from '@repo/api-contracts';
import type { Request, Response } from 'express';
import { assertTrustedOrigin, sessionToken } from './auth-http.js';
import { AuthService, expertOf } from './auth.service.js';

export interface ExpertIdentity extends AuthExpert {
  id: string;
}

interface ExpertRequest extends Request {
  expert?: ExpertIdentity;
}

/** Wpuszcza tylko zalogowane konto, któremu ROPS nadał rolę eksperta. */
@Injectable()
export class ExpertGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<ExpertRequest>();
    http.getResponse<Response>().setHeader('Cache-Control', 'no-store');
    const account = await this.auth.accountForToken(sessionToken(request));
    if (!account) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: ErrorCodes.UNAUTHORIZED,
          message: 'Zaloguj się, aby otworzyć panel eksperta.',
        },
      });
    }
    const expert = expertOf(account);
    if (!expert) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: ErrorCodes.FORBIDDEN,
          message: 'To konto nie ma roli eksperta. Rolę nadaje ROPS.',
        },
      });
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method))
      assertTrustedOrigin(request);
    request.expert = { id: account.id, ...expert };
    return true;
  }
}

export const CurrentExpert = createParamDecorator(
  (_: unknown, context: ExecutionContext): ExpertIdentity => {
    const { expert } = context.switchToHttp().getRequest<ExpertRequest>();
    if (!expert) throw new UnauthorizedException();
    return expert;
  },
);
