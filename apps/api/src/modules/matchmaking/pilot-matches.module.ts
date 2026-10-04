import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { PilotMatchesController } from './pilot-matches.controller.js';
import { PilotMatchesService } from './pilot-matches.service.js';
import { PilotMatchesRepository } from './pilot-matches.repository.js';

@Module({
  imports: [PrismaModule],
  controllers: [PilotMatchesController],
  providers: [PilotMatchesService, PilotMatchesRepository],
})
export class PilotMatchesModule {}
