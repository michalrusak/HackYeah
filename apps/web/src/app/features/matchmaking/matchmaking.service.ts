import { Injectable, inject } from '@angular/core';
import type { ClarificationAnswer, MatchmakingData } from '@repo/api-contracts';
import type { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class MatchmakingService {
  private readonly api = inject(ApiService);

  match(
    description: string,
    answers: ClarificationAnswer[] = [],
  ): Observable<MatchmakingData> {
    return this.api.matchInnovations(description, answers);
  }
}
