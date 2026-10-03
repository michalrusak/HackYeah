import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AiModule } from '../../shared/ai/ai.module.js';
import { MatchmakingModule } from '../matchmaking/matchmaking.module.js';
import { ApplicationsController } from './applications/applications.controller.js';
import { ApplicationsRepository } from './applications/applications.repository.js';
import { ApplicationsService } from './applications/applications.service.js';
import { AssistantController } from './assistant/assistant.controller.js';
import { AssistantRepository } from './assistant/assistant.repository.js';
import { AssistantService } from './assistant/assistant.service.js';
import { VisualService } from './assistant/visual.service.js';
import { CallsController } from './calls/calls.controller.js';
import { CallsRepository } from './calls/calls.repository.js';
import { CallsService } from './calls/calls.service.js';
import { CanvasController } from './canvas/canvas.controller.js';
import { CanvasRepository } from './canvas/canvas.repository.js';
import { CanvasService } from './canvas/canvas.service.js';
import { IdeasController } from './ideas/ideas.controller.js';
import { IdeasRepository } from './ideas/ideas.repository.js';
import { IdeasService } from './ideas/ideas.service.js';
import { MaterialsController } from './materials/materials.controller.js';

@Module({
  imports: [ConfigModule, PrismaModule, AiModule, MatchmakingModule],
  controllers: [
    IdeasController,
    CanvasController,
    CallsController,
    ApplicationsController,
    AssistantController,
    MaterialsController,
  ],
  providers: [
    IdeasService,
    IdeasRepository,
    CanvasService,
    CanvasRepository,
    CallsService,
    CallsRepository,
    ApplicationsService,
    ApplicationsRepository,
    AssistantService,
    AssistantRepository,
    VisualService,
  ],
})
export class IdeaCreatorModule {}
