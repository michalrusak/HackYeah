import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdaptationController } from './adaptation.controller.js';
import { AdaptationService } from './adaptation.service.js';

@Module({
  imports: [ConfigModule],
  controllers: [AdaptationController],
  providers: [AdaptationService],
})
export class AdaptationModule {}
