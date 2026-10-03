import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  createApiSuccess,
  MATCHMAKING_RESULT_LIMIT,
  type ClarificationAnswer,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type MatchmakingData,
} from '@repo/api-contracts';
import { KnowledgeRepository } from '../knowledge/knowledge.repository.js';
import { utcDay } from '../knowledge/knowledge.service.js';
import { CatalogRepository } from './catalog.repository.js';
import {
  InterpretationError,
  OpenRouterService,
} from './openrouter.service.js';
import { rankInnovations, matchInformation } from './ranking.js';
import { buildClarification } from './clarification.js';

export interface MatchmakingOutcome {
  status: number;
  body: ApiSuccessResponse<MatchmakingData> | ApiErrorResponse;
}

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);

  constructor(
    @Inject(OpenRouterService) private readonly interpreter: OpenRouterService,
    @Inject(CatalogRepository) private readonly catalog: CatalogRepository,
    @Optional()
    @Inject(KnowledgeRepository)
    private readonly knowledge?: KnowledgeRepository,
  ) {}

  async match(
    description: string,
    answers: ClarificationAnswer[] = [],
    signal = false,
  ): Promise<MatchmakingOutcome> {
    try {
      const interpretation = answers.length
        ? await this.interpreter.interpret(description, answers)
        : await this.interpreter.interpret(description);
      if (signal && this.knowledge && interpretation.areas.length)
        await this.knowledge
          .recordNeed(
            { areas: interpretation.areas, needs: interpretation.needs },
            utcDay(new Date()),
            'matchmaking',
          )
          .catch(() =>
            this.logger.warn('Nie zapisano sygnału potrzeby z matchmakingu.'),
          );
      const catalog = await this.catalog.snapshot();
      const allMatches = rankInnovations(
        interpretation,
        catalog.innovations,
        Infinity,
      );
      const clarification = buildClarification(
        interpretation,
        allMatches.length,
        answers,
      );
      const matches = allMatches.slice(0, MATCHMAKING_RESULT_LIMIT);
      return {
        status: 200,
        body: createApiSuccess({
          interpretation,
          matches,
          ...(clarification ? { clarification } : {}),
          relatedInformation: matchInformation(
            interpretation,
            catalog.information,
          ),
          catalog: catalog.metadata,
        }),
      };
    } catch (error) {
      if (!(error instanceof InterpretationError)) throw error;
      return {
        status: error.status,
        body: {
          success: false,
          error: {
            code: error.code,
            message: 'Nie udało się zinterpretować opisu. Spróbuj ponownie.',
          },
        },
      };
    }
  }
}
