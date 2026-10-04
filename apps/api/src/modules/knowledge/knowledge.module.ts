import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { KnowledgeRepository } from './knowledge.repository.js';
import { KnowledgeService } from './knowledge.service.js';
import { KnowledgeController } from './knowledge.controller.js';
import { KnowledgeAdminController } from './knowledge-admin.controller.js';
import { KnowledgeAuthService } from './knowledge-auth.service.js';
import { KnowledgeAdminGuard } from './knowledge-admin.guard.js';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [KnowledgeController, KnowledgeAdminController],
  providers: [
    KnowledgeRepository,
    KnowledgeService,
    KnowledgeAuthService,
    KnowledgeAdminGuard,
  ],
  // Strażnik sesji administratora chroni też moderację pomysłów.
  exports: [KnowledgeRepository, KnowledgeAuthService, KnowledgeAdminGuard],
})
export class KnowledgeModule {}
