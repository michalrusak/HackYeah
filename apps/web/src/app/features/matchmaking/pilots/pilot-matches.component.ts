import {
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { type Interpretation, type PilotMatch } from '@repo/api-contracts';
import { Subscription } from 'rxjs';
import { PilotMatchesService } from './pilot-matches.service';
import { PilotInterestComponent } from './pilot-interest.component';

@Component({
  selector: 'app-pilot-matches',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    TranslatePipe,
    PilotInterestComponent,
  ],
  templateUrl: './pilot-matches.component.html',
  styleUrl: './pilot-matches.component.scss',
})
export class PilotMatchesComponent {
  readonly interpretation = input.required<Interpretation>();
  readonly automatic = input(false);
  readonly matchesFound = output<number>();
  private readonly service = inject(PilotMatchesService);
  private readonly destroyRef = inject(DestroyRef);
  private request: Subscription | null = null;
  readonly requested = signal(false);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly matches = signal<PilotMatch[]>([]);
  readonly selected = signal<string | null>(null);
  constructor() {
    effect(() => {
      this.interpretation();
      const automatic = this.automatic();
      untracked(() => {
        this.request?.unsubscribe();
        this.requested.set(false);
        this.loading.set(false);
        this.failed.set(false);
        this.matches.set([]);
        this.matchesFound.emit(0);
        this.selected.set(null);
        if (automatic) this.load();
      });
    });
  }
  load(): void {
    if (this.loading()) return;
    this.requested.set(true);
    this.loading.set(true);
    this.failed.set(false);
    this.request = this.service
      .match(this.interpretation())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ matches }) => {
          this.matches.set(matches);
          this.matchesFound.emit(matches.length);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }
}
