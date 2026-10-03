import { Router, RouterLink } from '@angular/router';
import { AdaptationService } from '../adaptation/adaptation.service';
import { HttpErrorResponse } from '@angular/common/http';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
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
  ClarificationAnswerSchema,
  type ClarificationAnswer,
  type MatchmakingData,
} from '@repo/api-contracts';
import { MatchmakingService } from './matchmaking.service';

@Component({
  selector: 'app-matchmaking',
  imports: [
    ReactiveFormsModule,
    RouterLink,
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
  private readonly router = inject(Router);
  private readonly adaptation = inject(AdaptationService);

  adapt(): void {
    this.adaptation.begin(this.description.value);
    void this.router.navigate(['/dostosuj/mobilne-centrum-pomocy']);
  }

  private readonly service = inject(MatchmakingService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly descriptionInput =
    viewChild<ElementRef<HTMLTextAreaElement>>('descriptionInput');
  private readonly responseHeading =
    viewChild<ElementRef<HTMLElement>>('responseHeading');
  private readonly errorPanel =
    viewChild<ElementRef<HTMLElement>>('errorPanel');
  readonly description = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(4000)],
  });
  readonly form = new FormGroup({ description: this.description });
  readonly examples = ['seniors', 'migrants', 'school'];
  readonly loading = signal(false);
  readonly result = signal<MatchmakingData | null>(null);
  readonly errorKey = signal<string | null>(null);
  readonly answers = signal<ClarificationAnswer[]>([]);
  readonly clarificationDismissed = signal(false);
  readonly answer = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.maxLength(1000),
      Validators.pattern(/\S/),
    ],
  });
  readonly answerForm = new FormGroup({ answer: this.answer });
  private readonly clarificationHeading = viewChild<ElementRef<HTMLElement>>(
    'clarificationHeading',
  );
  private readonly answerInput =
    viewChild<ElementRef<HTMLTextAreaElement>>('answerInput');
  private failedAnswers: ClarificationAnswer[] | null = null;

  submitAnswer(): void {
    if (this.loading()) return;
    const question = this.result()?.clarification?.question;
    const parsed = ClarificationAnswerSchema.safeParse({
      question,
      answer: this.answer.value,
    });
    if (!parsed.success) {
      this.answer.markAsTouched();
      this.answerInput()?.nativeElement.focus();
      return;
    }
    this.search([...this.answers(), parsed.data]);
  }

  retry(): void {
    this.search(this.failedAnswers ?? this.answers());
  }

  dismissClarification(): void {
    this.clarificationDismissed.set(true);
    this.responseHeading()?.nativeElement.focus();
  }

  constructor() {
    this.description.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.result.set(null);
        this.errorKey.set(null);
        this.answers.set([]);
        this.answer.reset();
        this.clarificationDismissed.set(false);
        this.failedAnswers = null;
      });
  }

  useExample(example: string): void {
    this.description.setValue(
      this.translate.instant(`matchmaking.examples.${example}.description`),
    );
    this.editDescription();
  }

  editDescription(): void {
    this.descriptionInput()?.nativeElement.focus();
  }

  submit(): void {
    this.search(this.answers());
  }

  private search(answers: ClarificationAnswer[]): void {
    if (this.loading()) return;
    const parsed = MatchmakingRequestSchema.safeParse({
      description: this.description.value,
      answers,
    });
    if (!parsed.success) {
      this.description.setErrors({ invalidDescription: true });
      this.description.markAsTouched();
      this.editDescription();
      return;
    }
    this.loading.set(true);
    this.errorKey.set(null);
    this.failedAnswers = null;
    this.answer.disable({ emitEvent: false });
    this.description.disable({ emitEvent: false });
    this.service
      .match(parsed.data.description, answers)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.result.set(data);
          this.answers.set(answers);
          this.answer.reset('', { emitEvent: false });
          this.clarificationDismissed.set(false);
          this.finish();
          afterNextRender(
            () => {
              const heading = data.clarification
                ? this.clarificationHeading()
                : this.responseHeading();
              heading?.nativeElement.focus();
            },
            { injector: this.injector },
          );
        },
        error: (error: unknown) => {
          this.failedAnswers = answers;
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
          afterNextRender(() => this.errorPanel()?.nativeElement.focus(), {
            injector: this.injector,
          });
        },
      });
  }

  private finish(): void {
    this.loading.set(false);
    this.answer.enable({ emitEvent: false });
    this.description.enable({ emitEvent: false });
  }
}
