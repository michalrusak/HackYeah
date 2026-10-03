// apps/api-nest/src/common/guards/api-key.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ErrorCode } from '@repo/api-contracts';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const key = request.headers['x-api-key'];
    const validKeys = (process.env.API_KEYS ?? '').split(',').filter(Boolean);

    if (!key || !validKeys.includes(key)) {
      throw new UnauthorizedException({
        success: false,
        error: { code: ErrorCode.UNAUTHORIZED, message: 'Invalid or missing API key' },
      });
    }

    return true;
  }
}

// Usage:
// @Public()
// @UseGuards(ApiKeyGuard)
// @Post('webhooks/stripe')
// handleWebhook() { ... }
