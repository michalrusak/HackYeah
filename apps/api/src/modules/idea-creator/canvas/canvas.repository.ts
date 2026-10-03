import { Inject, Injectable } from '@nestjs/common';
import {
  CanvasTemplateSchema,
  type CanvasAnswers,
  type CanvasTemplate,
} from '@repo/api-contracts';
import { PrismaService } from '../../../prisma/prisma.service.js';
import template from './canvas.v1.json' with { type: 'json' };

export interface CanvasRow {
  version: number;
  answers: unknown;
  updatedAt: Date;
}

@Injectable()
export class CanvasRepository {
  // Szablon jest wersjonowanym plikiem, nie rekordem w bazie — podmiana na
  // oficjalne plansze ROPS nie wymaga wtedy migracji.
  private readonly template = CanvasTemplateSchema.parse(template);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  getTemplate(): CanvasTemplate {
    return this.template;
  }

  async findByIdeaId(ideaId: string): Promise<CanvasRow | null> {
    return this.prisma.ideaCanvas.findUnique({
      where: { ideaId },
      select: { version: true, answers: true, updatedAt: true },
    });
  }

  async save(ideaId: string, answers: CanvasAnswers): Promise<CanvasRow> {
    return this.prisma.ideaCanvas.upsert({
      where: { ideaId },
      create: { ideaId, version: this.template.version, answers },
      update: { version: this.template.version, answers },
      select: { version: true, answers: true, updatedAt: true },
    });
  }
}
