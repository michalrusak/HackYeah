import { inject, Injectable } from '@angular/core';
import { Observable, timeout } from 'rxjs';
import {
  PilotMatchesDataSchema,
  PilotMatchRequestSchema,
  TesterApplicationInputSchema,
  TesterProjectDetailDataSchema,
  type Interpretation,
  type PilotMatchesData,
  type TesterProjectDetailData,
} from '@repo/api-contracts';
import { ApiService } from '../../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class PilotMatchesService {
  private readonly api = inject(ApiService);
  match(interpretation: Interpretation): Observable<PilotMatchesData> {
    return this.api
      .request('POST', '/matchmaking/pilots', PilotMatchesDataSchema, {
        body: PilotMatchRequestSchema.parse({ interpretation }),
      })
      .pipe(timeout(15000));
  }
  apply(id: string, message: string): Observable<TesterProjectDetailData> {
    return this.api
      .request(
        'PUT',
        `/testers/projects/${id}/pilot-interest`,
        TesterProjectDetailDataSchema,
        {
          withCredentials: true,
          body: TesterApplicationInputSchema.parse({ message }),
        },
      )
      .pipe(timeout(20000));
  }
}
