import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import type { GrantCall } from '@repo/api-contracts';
import { toErrorKey } from '../../services/api-error';
import { IdeaCreatorApiService } from '../../services/idea-creator-api.service';

@Component({
  selector: 'app-calls',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressBarModule,
    TranslatePipe,
  ],
  templateUrl: './calls.component.html',
  styleUrl: './calls.component.scss',
})
export class CallsComponent implements OnInit {
  private readonly api = inject(IdeaCreatorApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly calls = signal<GrantCall[]>([]);
  readonly hasOpenCall = signal(false);
  readonly nextOpeningAt = signal<string | null>(null);
  readonly loading = signal(true);
  readonly errorKey = signal<string | null>(null);

  ngOnInit(): void {
    this.api
      .listCalls()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.calls.set(data.calls);
          this.hasOpenCall.set(data.hasOpenCall);
          this.nextOpeningAt.set(data.nextOpeningAt);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.errorKey.set(toErrorKey(error));
          this.loading.set(false);
        },
      });
  }
}
