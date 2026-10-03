import { Inject, Injectable } from '@nestjs/common';
import {
  createApiSuccess,
  MATCHMAKING_RESULT_LIMIT,
  type ClarificationAnswer,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type MatchmakingData,
} from '@repo/api-contracts';
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
  constructor(
    @Inject(OpenRouterService) private readonly interpreter: OpenRouterService,
    @Inject(CatalogRepository) private readonly catalog: CatalogRepository,
  ) {}

  async match(
    description: string,
    answers: ClarificationAnswer[] = [],
  ): Promise<MatchmakingOutcome> {
    try {
      const interpretation = answers.length
        ? await this.interpreter.interpret(description, answers)
        : await this.interpreter.interpret(description);
      const allMatches = rankInnovations(
        interpretation,
        this.catalog.findAll(),
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
            this.catalog.findInformation(),
          ),
          catalog: this.catalog.metadata(),
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
