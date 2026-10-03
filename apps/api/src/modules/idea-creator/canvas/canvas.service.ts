import { Inject, Injectable } from '@nestjs/common';
import {
  CanvasAnswersSchema,
  CanvasSuggestionsDataSchema,
  canvasSuggestionsJsonSchema,
  type CanvasAnswers,
  type CanvasData,
  type CanvasSuggestionsData,
  type CanvasTemplate,
} from '@repo/api-contracts';
import { OpenRouterClient } from '../../../shared/ai/openrouter.client.js';
import { DomainError } from '../../../shared/errors/domain.error.js';
import { IdeasService } from '../ideas/ideas.service.js';
import { CanvasRepository } from './canvas.repository.js';

const SUGGESTION_SYSTEM =
  'Pomagasz wypełnić Canvę innowacji społecznej. Dla każdego pola napisz ' +
  'konkretną propozycję treści po polsku, wynikającą z opisu pomysłu. ' +
  'Nie powtarzaj pytania, nie pisz ogólników typu „należy przeanalizować”. ' +
  'Używaj wyłącznie identyfikatorów pól podanych w zapytaniu. ' +
  'Jeśli dla danego pola brakuje podstaw w opisie, pomiń je zamiast zmyślać. ' +
  'Odpowiedz wyłącznie JSON-em zgodnym ze schematem.';

@Injectable()
export class CanvasService {
  constructor(
    @Inject(CanvasRepository) private readonly repository: CanvasRepository,
    @Inject(IdeasService) private readonly ideas: IdeasService,
    @Inject(OpenRouterClient) private readonly ai: OpenRouterClient,
  ) {}

  getTemplate(): CanvasTemplate {
    return this.repository.getTemplate();
  }

  async get(ideaId: string, token: string | undefined): Promise<CanvasData> {
    await this.ideas.get(ideaId, token);
    const row = await this.repository.findByIdeaId(ideaId);
    if (!row) {
      return {
        version: this.repository.getTemplate().version,
        answers: {},
        updatedAt: null,
      };
    }
    return {
      version: row.version,
      answers: this.parseAnswers(row.answers),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async save(
    ideaId: string,
    token: string | undefined,
    answers: CanvasAnswers,
  ): Promise<CanvasData> {
    await this.ideas.requireOwned(ideaId, token);
    const row = await this.repository.save(ideaId, this.keepKnownFields(answers));
    return {
      version: row.version,
      answers: this.parseAnswers(row.answers),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async suggest(
    ideaId: string,
    token: string | undefined,
  ): Promise<CanvasSuggestionsData> {
    const idea = await this.ideas.get(ideaId, token);
    const template = this.repository.getTemplate();
    const fields = template.fields
      .map((field) => `- ${field.id}: ${field.title} — ${field.question}`)
      .join('\n');
    const result = await this.ai.completeJson({
      schemaName: 'canvas_suggestions',
      jsonSchema: canvasSuggestionsJsonSchema,
      resultSchema: CanvasSuggestionsDataSchema,
      system: SUGGESTION_SYSTEM,
      maxTokens: 3000,
      event: 'canvas_suggestions',
      messages: [
        {
          role: 'user',
          content: [
            `Tytuł: ${idea.title}`,
            `Istota: ${idea.essence}`,
            `Problem: ${idea.problem}`,
            `Odbiorcy: ${idea.targetAudience}`,
            idea.description ? `Opis: ${idea.description}` : '',
            '',
            'Pola Canvy:',
            fields,
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ],
    });
    const known = new Set(template.fields.map((field) => field.id));
    return {
      suggestions: result.suggestions.filter((item) => known.has(item.fieldId)),
    };
  }

  /** Odpowiedzi do pól spoza aktualnego szablonu są odrzucane przy zapisie. */
  private keepKnownFields(answers: CanvasAnswers): CanvasAnswers {
    const known = new Set(
      this.repository.getTemplate().fields.map((field) => field.id),
    );
    return Object.fromEntries(
      Object.entries(answers).filter(([key]) => known.has(key)),
    );
  }

  private parseAnswers(value: unknown): CanvasAnswers {
    const parsed = CanvasAnswersSchema.safeParse(value);
    if (!parsed.success) {
      throw DomainError.conflict(
        'Zapisana Canva ma nieoczekiwany format. Odśwież stronę i spróbuj ponownie.',
      );
    }
    return parsed.data;
  }
}
