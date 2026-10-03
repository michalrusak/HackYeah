import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthModule } from './modules/health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { MatchmakingModule } from './modules/matchmaking/matchmaking.module.js';
import { KnowledgeModule } from './modules/knowledge/knowledge.module.js';
import { TestersModule } from './modules/testers/testers.module.js';
import { IdeaCreatorModule } from './modules/idea-creator/idea-creator.module.js';
import { ContactModule } from './modules/contact/contact.module.js';
import { TesterProjectsModule } from './modules/tester-projects/tester-projects.module.js';

import { AdaptationModule } from './modules/adaptation/adaptation.module.js';

const isTestEnv = process.env.NODE_ENV === 'test';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    // Kreator pomysłów wymaga bazy, więc dzieli los PrismaModule w testach.
    ...(isTestEnv
      ? []
      : [PrismaModule, IdeaCreatorModule, KnowledgeModule, ContactModule]),
    HealthModule,
    MatchmakingModule,
    AdaptationModule,
    ...(isTestEnv ? [] : [TestersModule, TesterProjectsModule]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
