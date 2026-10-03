import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenRouterClient } from './openrouter.client.js';

@Module({
  imports: [ConfigModule],
  providers: [OpenRouterClient],
  exports: [OpenRouterClient],
})
export class AiModule {}
