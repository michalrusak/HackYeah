import {
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AdminSession } from '@repo/api-contracts';
import { KnowledgeAuthService } from './knowledge-auth.service.js';

export interface KnowledgeAdminRequest extends Request {
  knowledgeSession: AdminSession;
  knowledgeSessionId: string;
}

@Injectable()
export class KnowledgeAdminGuard implements CanActivate {
  constructor(
    @Inject(KnowledgeAuthService) private readonly auth: KnowledgeAuthService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<KnowledgeAdminRequest>();
    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Cache-Control', 'no-store');
    const result = await this.auth.authenticate(request);
    request.knowledgeSession = result.session;
    request.knowledgeSessionId = result.id;
    return true;
  }
}
