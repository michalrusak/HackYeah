import { Subject, takeUntil } from 'rxjs';
import { type ErrorStateMatcher } from '@angular/material/core';
import { SpeechInputService } from './speech-input.service';
import { PilotMatchesComponent } from './pilots/pilot-matches.component';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { AdaptationService } from '../adaptation/adaptation.service';
import { HttpErrorResponse } from '@angular/common/http';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule, type MatButton } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ApiErrorResponseSchema,
  MatchmakingRequestSchema,
  ClarificationAnswerSchema,
  type ClarificationAnswer,
  type MatchmakingData,
  type InnovationMatch,
  InnovationSchema,
} from '@repo/api-contracts';
import { MatchmakingService } from './matchmaking.service';

@Component({
  selector: 'app-matchmaking',
  providers: [SpeechInputService],
  imports: [
    PilotMatchesComponent,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
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
  readonly voice = inject(SpeechInputService);
  readonly composerErrorState: ErrorStateMatcher = {
    isErrorState: (control) => !!control?.invalid && control.touched,
  };
  private readonly newChatRequested = new Subject<void>();
  private readonly chatScroll =
    viewChild<ElementRef<HTMLElement>>('chatScroll');

  newChat(): void {
    this.newChatRequested.next();
    this.voice.cancel();
    this.voice.error.set(null);
    this.finish();
    this.description.reset();
    this.followup.reset();
    afterNextRender(
      () => {
        this.chatScroll()?.nativeElement.scrollTo({ top: 0 });
        this.descriptionInput()?.nativeElement.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  toggleDictation(): void {
    if (this.voice.active()) {
      this.voice.stop();
      return;
    }
    if (this.loading()) return;
    const control = this.composerControl();
    const limit = this.composerLimit();
    if (control.value.length >= limit) {
      this.voice.error.set('voice.limit');
      return;
    }
    this.voice.start((text) => {
      const current = control.value;
      const separator = current && !/\s$/.test(current) ? ' ' : '';
      const next = current + separator + text;
      control.setValue(next.slice(0, limit));
      control.markAsDirty();
      this.onComposerInput();
      return next.length < limit;
    });
  }

  readonly editingDescription = signal(true);
  readonly submittedDescription = signal('');
  readonly noticeDismissed = signal(false);
  readonly pilotCount = signal(0);
  readonly followup = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.maxLength(4000),
      Validators.pattern(/\S/),
    ],
  });
  readonly answering = computed(
    () =>
      !this.editingDescription() &&
      !this.clarificationDismissed() &&
      !!this.result()?.clarification?.question,
  );
  readonly composerControl = computed(() =>
    this.answering()
      ? this.answer
      : this.result() && !this.editingDescription()
        ? this.followup
        : this.description,
  );
  readonly composerLimit = computed(() => (this.answering() ? 1000 : 4000));
  readonly foundCount = computed(
    () => (this.result()?.matches.length ?? 0) + this.pilotCount(),
  );
  private readonly replyHeading =
    viewChild<ElementRef<HTMLElement>>('replyHeading');
  private readonly resultsHeading =
    viewChild<ElementRef<HTMLElement>>('resultsHeading');
  private readonly pilotResults =
    viewChild<ElementRef<HTMLElement>>('pilotResults');

  submitComposer(): void {
    if (this.loading() || this.voice.active()) return;
    if (this.answering()) {
      this.submitAnswer();
      return;
    }
    if (this.result() && !this.editingDescription()) {
      if (this.followup.invalid) {
        this.followup.markAsTouched();
        return;
      }
      this.description.setValue(this.followup.value);
      this.followup.reset();
    }
    this.submit();
  }

  onComposerInput(): void {
    if (this.answering()) {
      this.selectedOption.set(-1);
      this.selectionRequired.set(false);
      this.customAnswer = this.answer.value;
    }
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.submitComposer();
    }
  }

  goToResults(): void {
    const target = this.result()?.matches.length
      ? this.resultsHeading()
      : this.pilotResults();
    this.noticeDismissed.set(true);
    target?.nativeElement.focus({ preventScroll: true });
    target?.nativeElement.scrollIntoView({ block: 'start' });
  }

  readonly examples = ['seniors', 'migrants', 'homelessness', 'pilot'];
  private readonly sanitizer = inject(DomSanitizer);
  readonly preview = signal<{ id: string; url: SafeResourceUrl } | null>(null);
  readonly previewLoading = signal(false);
  private readonly previewToggles = viewChildren<
    MatButton,
    ElementRef<HTMLButtonElement>
  >('previewToggle', { read: ElementRef });

  togglePreview(match: InnovationMatch): void {
    if (this.preview()?.id === match.id) {
      this.closePreview(match.id);
      return;
    }
    const parsed = InnovationSchema.shape.sourceUrl.safeParse(match.sourceUrl);
    if (!parsed.success) return;
    const url = new URL(parsed.data);
    if (
      url.origin !== 'https://rops.krakow.pl' ||
      url.username ||
      url.password ||
      !url.pathname.startsWith(
        '/innowacje-spoleczne/biblioteka-innowacji-spolecznych/',
      )
    )
      return;
    url.hash = 'content';
    this.previewLoading.set(true);
    this.preview.set({
      id: match.id,
      url: this.sanitizer.bypassSecurityTrustResourceUrl(url.href),
    });
    this.scrollPreviewToggle(match.id, 'start');
  }

  closePreview(id?: string): void {
    this.preview.set(null);
    this.previewLoading.set(false);
    if (id) this.scrollPreviewToggle(id, 'nearest', true);
  }

  private scrollPreviewToggle(
    id: string,
    block: ScrollLogicalPosition,
    focus = false,
  ): void {
    afterNextRender(
      () => {
        const button = this.previewToggles().find(
          (ref) => ref.nativeElement.id === `preview-toggle-${id}`,
        )?.nativeElement;
        if (focus) button?.focus();
        button?.scrollIntoView({ block });
      },
      { injector: this.injector },
    );
  }
  previewLoaded(id: string): void {
    if (this.preview()?.id === id) this.previewLoading.set(false);
  }

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
  readonly selectedOption = signal<number | null>(null);
  readonly selectionRequired = signal(false);
  readonly optionLetters = ['A', 'B', 'C'];
  private customAnswer = '';

  selectAnswer(value: unknown): void {
    if (this.loading() || this.voice.active() || typeof value !== 'number')
      return;
    const options = this.result()?.clarification?.options ?? [];
    if (value !== -1 && (!Number.isInteger(value) || !options[value])) return;
    if (this.selectedOption() === -1) this.customAnswer = this.answer.value;
    this.selectedOption.set(value);
    this.selectionRequired.set(false);
    this.answer.setValue(
      value === -1 ? this.customAnswer : (options[value] ?? ''),
    );
    if (value === -1) {
      afterNextRender(() => this.answerInput()?.nativeElement.focus(), {
        injector: this.injector,
      });
    }
  }

  private resetAnswerChoice(): void {
    this.selectedOption.set(null);
    this.selectionRequired.set(false);
    this.customAnswer = '';
  }
  private readonly clarificationHeading = viewChild<ElementRef<HTMLElement>>(
    'clarificationHeading',
  );
  private readonly answerInput =
    viewChild<ElementRef<HTMLTextAreaElement>>('answerInput');
  private failedAnswers: ClarificationAnswer[] | null = null;

  submitAnswer(): void {
    if (this.loading()) return;
    if (
      this.result()?.clarification?.options?.length &&
      this.selectedOption() === null
    ) {
      this.selectionRequired.set(true);
      return;
    }
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
        this.editingDescription.set(true);
        this.submittedDescription.set('');
        this.pilotCount.set(0);
        this.noticeDismissed.set(false);
        this.closePreview();
        this.errorKey.set(null);
        this.answers.set([]);
        this.answer.reset();
        this.resetAnswerChoice();
        this.clarificationDismissed.set(false);
        this.failedAnswers = null;
      });
  }

  useExample(example: string): void {
    if (this.voice.active()) return;
    this.description.setValue(
      this.translate.instant(`matchmaking.examples.${example}.description`),
    );
    this.editDescription();
  }

  editDescription(): void {
    if (this.loading() || this.voice.active()) return;
    this.editingDescription.set(true);
    this.descriptionInput()?.nativeElement.focus();
  }

  submit(): void {
    this.search(this.answers());
  }

  private search(answers: ClarificationAnswer[]): void {
    if (this.loading() || this.voice.active()) return;
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
    this.submittedDescription.set(parsed.data.description);
    this.noticeDismissed.set(false);
    this.loading.set(true);
    this.errorKey.set(null);
    this.failedAnswers = null;
    this.followup.disable({ emitEvent: false });
    this.answer.disable({ emitEvent: false });
    this.description.disable({ emitEvent: false });
    this.service
      .match(parsed.data.description, answers)
      .pipe(
        takeUntil(this.newChatRequested),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (data) => {
          this.closePreview();
          this.pilotCount.set(0);
          this.result.set(data);
          this.editingDescription.set(false);
          this.answers.set(answers);
          this.answer.reset('', { emitEvent: false });
          this.resetAnswerChoice();
          this.clarificationDismissed.set(false);
          this.finish();
          afterNextRender(
            () => {
              const heading = data.clarification
                ? this.clarificationHeading()
                : this.replyHeading();
              heading?.nativeElement.focus({ preventScroll: true });
              (
                heading?.nativeElement.closest('article, section') ??
                heading?.nativeElement
              )?.scrollIntoView({ block: 'start' });
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
    this.followup.enable({ emitEvent: false });
    this.answer.enable({ emitEvent: false });
    this.description.enable({ emitEvent: false });
  }
}
