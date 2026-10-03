import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCodes, TesterOwnerKeySchema } from '@repo/api-contracts';
import { AuthService, credentialHash } from './auth.service.js';
import {
  assertTrustedOrigin,
  sessionToken,
  type TesterRequest,
} from './auth-http.js';

export const REQUIRE_ACCOUNT = 'tester-require-account';
export const OPTIONAL_ACCOUNT = 'tester-optional-account';

@Injectable()
export class TesterAuthGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TesterRequest>();
    const token = sessionToken(request);
    const account = await this.auth.accountForToken(token);
    if (account) {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method))
        assertTrustedOrigin(request);
      request.testerOwnerHash = account.ownerHash;
      request.testerAccountId = account.id;
      return true;
    }
    if (this.reflector.get<boolean>(OPTIONAL_ACCOUNT, context.getHandler()))
      return true;
    const requiresAccount = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_ACCOUNT,
      [context.getHandler(), context.getClass()],
    );
    const guestKey = TesterOwnerKeySchema.safeParse(
      request.headers['x-tester-key'],
    );
    if (!requiresAccount && !token && guestKey.success) {
      const ownerHash = credentialHash(guestKey.data);
      if (!(await this.auth.isClaimedOwner(ownerHash))) {
        request.testerOwnerHash = ownerHash;
        return true;
      }
    }
    throw new UnauthorizedException({
      success: false,
      error: {
        code: ErrorCodes.UNAUTHORIZED,
        message: 'Zaloguj się, aby uzyskać dostęp do swoich danych.',
      },
    });
  }
}
