import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ApiErrorResponseSchema,
  MatchmakingRequestSchema,
  type MatchmakingData,
} from '@repo/api-contracts';
import { MatchmakingService } from './matchmaking.service';

@Component({
  selector: 'app-matchmaking',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressBarModule,
    TranslatePipe,
  ],
  templateUrl: './matchmaking.component.html',
  styleUrl: './matchmaking.component.scss',
})
export class MatchmakingComponent {
  private readonly service = inject(MatchmakingService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  readonly description = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(4000)],
  });
  readonly form = new FormGroup({ description: this.description });
  readonly examples = ['seniors', 'migrants', 'school'];
  readonly loading = signal(false);
  readonly result = signal<MatchmakingData | null>(null);
  readonly errorKey = signal<string | null>(null);

  constructor() {
    this.description.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.result.set(null);
        this.errorKey.set(null);
      });
  }

  useExample(example: string): void {
    this.description.setValue(
      this.translate.instant(`matchmaking.examples.${example}.description`),
    );
  }

  submit(): void {
    if (this.loading()) return;
    const parsed = MatchmakingRequestSchema.safeParse({
      description: this.description.value,
    });
    if (!parsed.success) {
      this.description.setErrors({ invalidDescription: true });
      this.description.markAsTouched();
      return;
    }
    this.loading.set(true);
    this.result.set(null);
    this.errorKey.set(null);
    this.description.disable({ emitEvent: false });
    this.service
      .match(parsed.data.description)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.result.set(data);
          this.finish();
        },
        error: (error: unknown) => {
          const parsedError =
            error instanceof HttpErrorResponse
              ? ApiErrorResponseSchema.safeParse(error.error)
              : null;
          const code = parsedError?.success
            ? parsedError.data.error.code
            : null;
          const keys: Record<string, string> = {
            AI_NOT_CONFIGURED: 'notConfigured',
            AI_UNAVAILABLE: 'unavailable',
            AI_TIMEOUT: 'timeout',
            AI_INVALID_RESPONSE: 'invalidResponse',
            RATE_LIMIT: 'rateLimit',
            VALIDATION_ERROR: 'validation',
          };
          this.errorKey.set(
            `matchmaking.errors.${code ? (keys[code] ?? 'generic') : error instanceof HttpErrorResponse && error.status === 429 ? 'rateLimit' : 'generic'}`,
          );
          this.finish();
        },
      });
  }

  private finish(): void {
    this.loading.set(false);
    this.description.enable({ emitEvent: false });
  }
}
