import { Injectable, signal } from '@angular/core';

/**
 * Powłoka modułu trzyma jeden panel asystenta, a poszczególne strony podają
 * mu kontekst. Dzięki temu rozmowa nie znika przy przejściu między widokami.
 */
@Injectable({ providedIn: 'root' })
export class AssistantContextService {
  readonly ideaId = signal<string | undefined>(undefined);
  readonly seed = signal('');

  set(ideaId: string | undefined, seed: string): void {
    this.ideaId.set(ideaId);
    this.seed.set(seed);
  }

  clear(): void {
    this.ideaId.set(undefined);
    this.seed.set('');
  }
}
