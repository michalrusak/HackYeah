import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
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
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
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

  readonly alertEmail = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  });
  readonly availableAreas = [
    'Seniorzy',
    'Zdrowie psychiczne',
    'Dostępność',
    'Wykluczenie cyfrowe',
    'Usługi społeczne',
  ];
  readonly selectedAreas = signal<string[]>([]);
  readonly subscribing = signal(false);
  readonly subscribeSuccess = signal(false);
  readonly subscribeError = signal<string | null>(null);

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

  toggleArea(area: string): void {
    const current = this.selectedAreas();
    if (current.includes(area)) {
      this.selectedAreas.set(current.filter((a) => a !== area));
    } else {
      this.selectedAreas.set([...current, area]);
    }
  }

  isAreaSelected(area: string): boolean {
    return this.selectedAreas().includes(area);
  }

  subscribeAlert(): void {
    if (this.alertEmail.invalid || this.subscribing()) {
      this.alertEmail.markAsTouched();
      return;
    }
    this.subscribing.set(true);
    this.subscribeError.set(null);
    this.api
      .subscribeCallAlerts(this.alertEmail.value.trim(), this.selectedAreas())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.subscribing.set(false);
          this.subscribeSuccess.set(true);
          this.alertEmail.reset();
        },
        error: (error: unknown) => {
          this.subscribing.set(false);
          this.subscribeError.set(toErrorKey(error));
        },
      });
  }
}
