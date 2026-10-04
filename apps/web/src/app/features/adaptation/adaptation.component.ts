import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  AdaptationRequestSchema,
  ApiErrorResponseSchema,
  ADAPTABLE_INNOVATION_ID,
  type AdaptationRequest,
} from '@repo/api-contracts';
import { ContactDraftService } from '../../core/services/contact-draft.service';
import { AdaptationService } from './adaptation.service';

@Component({
  selector: 'app-adaptation',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressBarModule,
    TranslatePipe,
  ],
  templateUrl: './adaptation.component.html',
  styleUrl: './adaptation.component.scss',
})
export class AdaptationComponent {
  readonly session = inject(AdaptationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly draft = inject(ContactDraftService);
  private readonly injector = inject(Injector);
  private readonly responseHeading =
    viewChild<ElementRef<HTMLElement>>('responseHeading');
  readonly loading = signal(false);
  readonly errorKey = signal('');
  readonly answer = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(2000)],
  });
  readonly need = new FormControl(this.session.need(), {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(4000)],
  });
  readonly needForm = new FormGroup({ need: this.need });
  readonly answerForm = new FormGroup({ answer: this.answer });

  constructor() {
    const routeId = this.route.snapshot.paramMap.get('id');
    if (routeId) {
      this.session.innovationId.set(routeId);
    }
    const qTitle = this.route.snapshot.queryParamMap.get('title');
    if (qTitle) {
      this.session.innovationTitle.set(qTitle);
    }
    if (this.session.need() && !this.session.result()) this.start();
  }

  start(): void {
    if (this.loading()) return;
    this.request(this.need.value.trim(), []);
  }

  send(value = this.answer.value): void {
    if (this.loading() || !value.trim() || this.session.turns().length >= 16)
      return;
    this.answer.setValue(value);
    const question =
      this.session.result()?.advice.question ??
      this.translate.instant('adaptation.correction');
    this.request(this.session.need(), [
      ...this.session.turns(),
      { question, answer: value.trim() },
    ]);
  }

  skip(): void {
    this.send(this.translate.instant('adaptation.unknown'));
  }

  private request(need: string, turns: AdaptationRequest['turns']): void {
    const activeId = this.session.innovationId() || ADAPTABLE_INNOVATION_ID;
    const input = AdaptationRequestSchema.safeParse({
      innovationId: activeId,
      need,
      turns,
    });
    if (!input.success) {
      this.errorKey.set('adaptation.invalid');
      return;
    }
    this.loading.set(true);
    this.errorKey.set('');
    this.session
      .update(input.data.need, input.data.turns, activeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.session.need.set(input.data.need);
          this.session.turns.set(input.data.turns);
          this.session.result.set(data);
          this.answer.reset();
          this.loading.set(false);
          afterNextRender(() => this.responseHeading()?.nativeElement.focus(), {
            injector: this.injector,
          });
        },
        error: (error: unknown) => {
          const body =
            error instanceof HttpErrorResponse
              ? ApiErrorResponseSchema.safeParse(error.error)
              : null;
          const code = body?.success ? body.data.error.code : '';
          const keys: Record<string, string> = {
            AI_NOT_CONFIGURED: 'notConfigured',
            AI_TIMEOUT: 'timeout',
            RATE_LIMIT: 'rateLimit',
            AI_INVALID_RESPONSE: 'invalidResponse',
            AI_UNAVAILABLE: 'unavailable',
          };
          this.errorKey.set(
            `matchmaking.errors.${keys[code] ?? (error instanceof HttpErrorResponse && error.status === 429 ? 'rateLimit' : 'generic')}`,
          );
          this.loading.set(false);
        },
      });
  }

  exportPlan(): void {
    const url = URL.createObjectURL(
      new Blob([this.planText()], { type: 'text/plain;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lacznik-plan-dostosowania.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  prepareContact(): void {
    const result = this.session.result();
    if (!result || this.loading()) return;
    const t = (key: string): string =>
      this.translate.instant(`adaptation.${key}`);
    const body = [
      t('handoffIntro'),
      t('disclaimer'),
      '',
      result.advice.objective,
      '',
      t('handoffGaps'),
      ...result.advice.gaps.slice(0, 3).map((s) => `• ${s}`),
      '',
      t('budget'),
      result.advice.budget,
      '',
      t('handoffAttachment'),
    ].join('\n');
    this.draft.set(t('handoffSubject'), body);
    void this.router.navigate(['/rops-contact']);
  }

  private planText(): string {
    const result = this.session.result();
    if (!result) return '';
    const t = (key: string): string =>
      this.translate.instant(`adaptation.${key}`);
    const p = result.advice;
    return [
      t('title'),
      t('innovation'),
      t('disclaimer'),
      '',
      t('need'),
      this.session.need(),
      '',
      t('objective'),
      p.objective,
      '',
      t('resources'),
      ...p.resources.map(
        (r) => `• ${r.name}: ${r.detail} [${t('statuses.' + r.status)}]`,
      ),
      '',
      t('proposals'),
      ...p.proposals.map(
        (r) =>
          `• ${r.change}\n  ${t('tradeoff')}: ${r.tradeoff}\n  ${t('sourceBasis')}: ${r.sourceIds.map((id) => result.sources.find((s) => s.id === id)?.label ?? id).join('; ')}`,
      ),
      '',
      t('gaps'),
      ...p.gaps.map((s) => `• ${s}`),
      '',
      t('budget'),
      p.budget,
      '',
      t('nextSteps'),
      ...p.nextSteps.map((s) => `• ${s}`),
      '',
      t('sources'),
      ...result.sources.map((s) => `${s.label}\n${s.url}`),
      t('attribution'),
    ].join('\n');
  }
}
