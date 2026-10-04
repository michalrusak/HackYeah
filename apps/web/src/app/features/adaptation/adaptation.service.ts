import { Injectable, inject, signal } from '@angular/core';
import {
  AdaptationDataSchema,
  AdaptationRequestSchema,
  ADAPTABLE_INNOVATION_ID,
  type AdaptationData,
  type AdaptationRequest,
} from '@repo/api-contracts';
import { ApiService } from '../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class AdaptationService {
  private readonly api = inject(ApiService);
  readonly innovationId = signal<string>(ADAPTABLE_INNOVATION_ID);
  readonly innovationTitle = signal<string>('');
  readonly need = signal('');
  readonly turns = signal<AdaptationRequest['turns']>([]);
  readonly result = signal<AdaptationData | null>(null);

  begin(need: string, innovationId = ADAPTABLE_INNOVATION_ID, title = ''): void {
    if (this.need() === need && this.innovationId() === innovationId) return;
    this.innovationId.set(innovationId);
    this.innovationTitle.set(title);
    this.need.set(need);
    this.turns.set([]);
    this.result.set(null);
  }

  update(need: string, turns: AdaptationRequest['turns'], innovationId = this.innovationId()) {
    const body = AdaptationRequestSchema.parse({
      innovationId: innovationId || ADAPTABLE_INNOVATION_ID,
      need,
      turns,
    });
    return this.api.request('POST', '/adaptations', AdaptationDataSchema, {
      body,
    });
  }
}
