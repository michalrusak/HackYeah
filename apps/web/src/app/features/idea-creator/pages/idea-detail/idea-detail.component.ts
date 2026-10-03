import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { GrantCall, Idea, MatchmakingData } from '@repo/api-contracts';
import type { Observable } from 'rxjs';
import { toErrorKey } from '../../services/api-error';
import { AssistantContextService } from '../../services/assistant-context.service';
import { EditTokenStore } from '../../services/edit-token.store';
import { IdeaCreatorApiService } from '../../services/idea-creator-api.service';

@Component({
  selector: 'app-idea-detail',
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatProgressBarModule,
    TranslatePipe,
  ],
  templateUrl: './idea-detail.component.html',
  styleUrl: './idea-detail.component.scss',
})
export class IdeaDetailComponent implements OnInit {
  private readonly api = inject(IdeaCreatorApiService);
  private readonly tokens = inject(EditTokenStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly assistant = inject(AssistantContextService);

  readonly idea = signal<Idea | null>(null);
  readonly loading = signal(true);
  readonly errorKey = signal<string | null>(null);
  readonly busyAction = signal<string | null>(null);
  readonly plainLanguage = signal<string | null>(null);
  readonly showPlainLanguage = signal(false);
  readonly related = signal<MatchmakingData | null>(null);
  readonly openCall = signal<GrantCall | null>(null);

  readonly ideaId = computed(() => this.route.snapshot.paramMap.get('id') ?? '');
  readonly token = computed(() => this.tokens.ideaToken(this.ideaId()));
  readonly isOwner = computed(() => Boolean(this.token()));
  readonly visualUrl = computed(() => {
    const current = this.idea();
    return current?.visualId
      ? this.api.visualUrl(current.id, current.visualId)
      : null;
  });

  ngOnInit(): void {
    this.load();
    this.loadOpenCall();
  }

  togglePlainLanguage(): void {
    if (this.showPlainLanguage()) {
      this.showPlainLanguage.set(false);
      return;
    }
    if (this.plainLanguage()) {
      this.showPlainLanguage.set(true);
      return;
    }
    this.run('plainLanguage', this.api.plainLanguage(this.ideaId()), (data) => {
      this.plainLanguage.set(data.text);
      this.showPlainLanguage.set(true);
    });
  }

  loadRelated(): void {
    this.run(
      'related',
      this.api.relatedInnovations(this.ideaId(), this.token()),
      (data) => this.related.set(data),
    );
  }

  generateVisual(): void {
    this.run(
      'visual',
      this.api.generateVisual(this.ideaId(), '', this.token()),
      () => this.load(),
    );
  }

  publish(): void {
    this.run(
      'publish',
      this.api.publishIdea(this.ideaId(), this.token()),
      (data) => {
        this.idea.set(data.idea);
        this.notify('ideaCreator.detail.published');
      },
    );
  }

  /** Kopiuje dobrą praktykę jako własny szkic — ścieżka dla samorządów. */
  adopt(): void {
    this.run('adopt', this.api.adoptIdea(this.ideaId()), (created) => {
      this.tokens.rememberIdea({
        id: created.idea.id,
        title: created.idea.title,
        token: created.editToken,
      });
      void this.router.navigate(['/pomysly', created.idea.id]);
    });
  }

  startApplication(): void {
    const call = this.openCall();
    if (!call) return;
    const existing = this.tokens.applicationFor(this.ideaId(), call.id);
    if (existing) {
      void this.router.navigate(['/nabory', call.id, 'wniosek', existing.id]);
      return;
    }
    this.run(
      'application',
      this.api.createApplication(call.id, this.ideaId(), this.token()),
      (created) => {
        this.tokens.rememberApplication({
          id: created.application.id,
          ideaId: created.idea.id,
          ideaTitle: created.idea.title,
          callId: created.call.id,
          callName: created.call.name,
          token: created.editToken,
        });
        void this.router.navigate([
          '/nabory',
          created.call.id,
          'wniosek',
          created.application.id,
        ]);
      },
    );
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .getIdea(this.ideaId(), this.token())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.idea.set(data.idea);
          this.plainLanguage.set(data.idea.plainLanguageSummary);
          this.assistant.set(
            data.idea.id,
            `${data.idea.title}. ${data.idea.essence} ${data.idea.problem}`,
          );
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.errorKey.set(toErrorKey(error));
          this.loading.set(false);
        },
      });
  }

  private loadOpenCall(): void {
    this.api
      .listCalls()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.openCall.set(
            data.calls.find((call) => call.status === 'open') ?? null,
          );
        },
        error: () => this.openCall.set(null),
      });
  }

  private run<T>(
    action: string,
    source: Observable<T>,
    onSuccess: (value: T) => void,
  ): void {
    if (this.busyAction()) return;
    this.busyAction.set(action);
    this.errorKey.set(null);
    source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (value) => {
        onSuccess(value);
        this.busyAction.set(null);
      },
      error: (error: unknown) => {
        this.errorKey.set(toErrorKey(error));
        this.busyAction.set(null);
      },
    });
  }

  private notify(key: string): void {
    this.snackBar.open(
      this.translate.instant(key),
      this.translate.instant('ideaCreator.close'),
      { duration: 5000 },
    );
  }
}
