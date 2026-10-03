import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CatalogRepository } from './catalog.repository.js';
import { MatchmakingController } from './matchmaking.controller.js';
import { MatchmakingService } from './matchmaking.service.js';
import { OpenRouterService } from './openrouter.service.js';

@Module({
  imports: [ConfigModule],
  controllers: [MatchmakingController],
  providers: [MatchmakingService, CatalogRepository, OpenRouterService],
})
export class MatchmakingModule {}
