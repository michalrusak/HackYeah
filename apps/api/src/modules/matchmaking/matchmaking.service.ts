import { Inject, Injectable } from '@nestjs/common';
import {
  createApiSuccess,
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

  async match(description: string): Promise<MatchmakingOutcome> {
    try {
      const interpretation = await this.interpreter.interpret(description);
      const matches = rankInnovations(interpretation, this.catalog.findAll());
      return {
        status: 200,
        body: createApiSuccess({
          interpretation,
          matches,
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
