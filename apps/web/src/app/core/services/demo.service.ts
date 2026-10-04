import { Injectable, inject, signal } from '@angular/core';
import { DemoDataSchema, type DemoData } from '@repo/api-contracts';
import { ApiService } from './api.service';

/** Dane logowania demo dla jury; `null` poza trybem demo. */
@Injectable({ providedIn: 'root' })
export class DemoService {
  private readonly api = inject(ApiService);
  private readonly current = signal<DemoData | null>(null);
  readonly data = this.current.asReadonly();

  // Błąd oznacza zwykły tryb pracy: formularze logowania zostają puste.
  load(): void {
    this.api.request('GET', '/demo', DemoDataSchema).subscribe({
      next: (data) => this.current.set(data),
      error: () => this.current.set(null),
    });
  }
}
