import { Injectable, inject } from '@angular/core';
import type { MatchmakingData } from '@repo/api-contracts';
import type { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class MatchmakingService {
  private readonly api = inject(ApiService);

  match(description: string): Observable<MatchmakingData> {
    return this.api.matchInnovations(description);
  }
}
