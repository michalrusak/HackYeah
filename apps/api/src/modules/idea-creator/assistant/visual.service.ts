import { Inject, Injectable } from '@nestjs/common';
import type { VisualData } from '@repo/api-contracts';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { OpenRouterClient } from '../../../shared/ai/openrouter.client.js';
import { DomainError } from '../../../shared/errors/domain.error.js';
import { IdeasService } from '../ideas/ideas.service.js';

export interface StoredVisual {
  mimeType: string;
  data: Buffer;
}

@Injectable()
export class VisualService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(IdeasService) private readonly ideas: IdeasService,
    @Inject(OpenRouterClient) private readonly ai: OpenRouterClient,
  ) {}

  async generate(
    ideaId: string,
    token: string | undefined,
    hint: string,
  ): Promise<VisualData> {
    const idea = await this.ideas.requireOwned(ideaId, token);
    const prompt = [
      'Stwórz czytelną, przyjazną wizualizację koncepcyjną innowacji społecznej.',
      'Styl: spokojna ilustracja wektorowa, wysoki kontrast, bez tekstu na obrazie.',
      `Nazwa: ${idea.title}`,
      `Istota: ${idea.essence}`,
      `Odbiorcy: ${idea.targetAudience}`,
      hint ? `Dodatkowe wskazówki: ${hint}` : '',
      'Na końcu odpowiedzi napisz jedno zdanie po polsku opisujące, co widać na obrazie.',
    ]
      .filter(Boolean)
      .join('\n');

    const image = await this.ai.generateImage(prompt, 'idea_visual');
    // Obraz bez opisu alternatywnego łamałby WCAG 1.1.1, więc gdy model nie
    // zwróci tekstu, budujemy opis z danych fiszki.
    const altText =
      image.text.length > 0
        ? image.text.slice(0, 400)
        : `Ilustracja koncepcyjna innowacji „${idea.title}” dla odbiorców: ${idea.targetAudience}.`;

    const created = await this.prisma.ideaVisual.create({
      data: {
        ideaId,
        prompt,
        altText,
        mimeType: image.mimeType,
        data: Uint8Array.from(image.data),
        model: image.model,
      },
      select: { id: true, altText: true },
    });

    return {
      id: created.id,
      altText: created.altText,
      url: `/ideas/${ideaId}/visual/${created.id}`,
    };
  }

  async read(ideaId: string, visualId: string): Promise<StoredVisual> {
    const row = await this.prisma.ideaVisual.findFirst({
      where: { id: visualId, ideaId },
      select: { mimeType: true, data: true },
    });
    if (!row) throw DomainError.notFound('Nie znaleźliśmy tej wizualizacji.');
    return { mimeType: row.mimeType, data: Buffer.from(row.data) };
  }
}
