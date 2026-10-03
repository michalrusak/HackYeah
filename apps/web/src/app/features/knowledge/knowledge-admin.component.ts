import { HttpErrorResponse } from '@angular/common/http';
import {
  computed,
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslatePipe } from '@ngx-translate/core';
import {
  KnowledgeImportSchema,
  KnowledgeInputSchema,
  KnowledgeQuerySchema,
  type KnowledgeList,
  type KnowledgeResource,
  type KnowledgeSummary,
  type KnowledgeTrends,
  type ModerationListData,
} from '@repo/api-contracts';
import { catchError, EMPTY, filter, forkJoin, interval, switchMap } from 'rxjs';
import { IdeaModerationComponent } from './idea-moderation.component';
import { KnowledgeService } from './knowledge.service';
import { knowledgeError } from './knowledge-error';
import { ResourceEditorComponent } from './resource-editor.component';

type QueueFilter = 'all' | 'draft' | 'published' | 'stale';

@Component({
  selector: 'app-knowledge-admin',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    TranslatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    ResourceEditorComponent,
    IdeaModerationComponent,
  ],
  templateUrl: './knowledge-admin.component.html',
  styleUrls: ['./knowledge.component.scss', './knowledge-admin.component.scss'],
})
export class KnowledgeAdminComponent {
  readonly service = inject(KnowledgeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly panelHeading =
    viewChild<ElementRef<HTMLElement>>('panelHeading');
  readonly form = new FormGroup({
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
  readonly search = new FormControl('', { nonNullable: true });
  readonly importText = new FormControl('', { nonNullable: true });
  readonly checkingSession = signal(true);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly imported = signal<number | null>(null);
  readonly list = signal<KnowledgeList | null>(null);
  readonly summary = signal<KnowledgeSummary | null>(null);
  readonly filter = signal<QueueFilter>('all');
  readonly filters = computed(() => {
    const summary = this.summary();
    const counts: Record<QueueFilter, number> = {
      all: (summary?.published ?? 0) + (summary?.draft ?? 0),
      draft: summary?.draft ?? 0,
      published: summary?.published ?? 0,
      stale: summary?.stale ?? 0,
    };
    return (['all', 'draft', 'published', 'stale'] as const).map((id) => ({
      id,
      count: counts[id],
    }));
  });
  readonly trends = signal<KnowledgeTrends | null>(null);
  readonly rising = computed(
    () => this.trends()?.areas.filter((area) => area.rising) ?? [],
  );
  readonly ideas = signal<ModerationListData | null>(null);
  readonly tab = signal<'resources' | 'ideas' | 'trends'>('resources');
  readonly editing = signal(false);
  readonly selected = signal<KnowledgeResource | null>(null);
  readonly page = signal(1);

  constructor() {
    this.service
      .restoreSession()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.checkingSession.set(false);
          this.load();
        },
        error: () => {
          this.service.session.set(null);
          this.checkingSession.set(false);
        },
      });
  }

  /** Licznik nowych pomysłów odświeża się sam, gdy panel jest otwarty. */
  private readonly ideasPoll = interval(30_000)
    .pipe(
      filter(() => this.service.session() !== null && !this.loading()),
      switchMap(() =>
        this.service.moderationQueue().pipe(catchError(() => EMPTY)),
      ),
      takeUntilDestroyed(this.destroyRef),
    )
    .subscribe((queue) => this.ideas.set(queue));

  login(): void {
    if (this.loading() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.service
      .login(this.form.controls.password.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.form.reset();
          this.load();
          this.focusPanel();
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  logout(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.service
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.list.set(null);
          this.summary.set(null);
          this.ideas.set(null);
          this.trends.set(null);
          this.editing.set(false);
          this.error.set(null);
          this.notice.set(null);
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const filter = this.filter();
    const parsed = KnowledgeQuerySchema.safeParse({
      q: this.search.value,
      page: this.page(),
      status: filter === 'draft' || filter === 'published' ? filter : undefined,
      stale: filter === 'stale' ? '1' : undefined,
    });
    if (!parsed.success) {
      this.loading.set(false);
      this.error.set('knowledge.errors.validation');
      return;
    }
    forkJoin({
      list: this.service.list(parsed.data, true),
      summary: this.service.summary(),
      ideas: this.service.moderationQueue(),
      trends: this.service.trends(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.list.set(data.list);
          this.summary.set(data.summary);
          this.ideas.set(data.ideas);
          this.trends.set(data.trends);
          this.loading.set(false);
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  searchResources(): void {
    this.page.set(1);
    this.load();
  }
  selectFilter(filter: QueueFilter): void {
    this.filter.set(filter);
    this.page.set(1);
    this.load();
  }
  isStale(resource: KnowledgeResource): boolean {
    const before = this.summary()?.staleBefore;
    return before !== undefined && resource.verifiedAt < before;
  }
  // Szybkie akcje z listy: weryfikacja ustawia dzisiejszą datę sprawdzenia źródła.
  quick(
    resource: KnowledgeResource,
    action: 'publish' | 'confirm' | 'unpublish',
  ): void {
    if (this.loading()) return;
    const { revision, updatedAt: _updatedAt, ...current } = resource;
    const today = new Date().toISOString().slice(0, 10);
    const parsed = KnowledgeInputSchema.safeParse({
      ...current,
      ...(action === 'unpublish'
        ? { status: 'draft' }
        : { status: 'published', verifiedAt: today }),
    });
    if (!parsed.success) {
      this.error.set('knowledge.errors.validation');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.service
      .save(parsed.data, revision)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notice.set(`knowledge.admin.done.${action}`);
          this.load();
          this.focusPanel();
        },
        error: (error: unknown) => this.fail(error),
      });
  }
  changePage(direction: number): void {
    this.page.update((page) => page + direction);
    this.load();
  }
  edit(resource: KnowledgeResource | null): void {
    this.notice.set(null);
    this.editing.set(false);
    this.selected.set(resource);
    afterNextRender(
      () => {
        this.editing.set(true);
      },
      { injector: this.injector },
    );
  }
  saved(): void {
    this.editing.set(false);
    this.notice.set('knowledge.admin.saved');
    this.load();
    this.focusPanel();
  }

  importResources(): void {
    if (this.loading()) return;
    let json: unknown;
    try {
      json = JSON.parse(this.importText.value);
    } catch {
      this.error.set('knowledge.errors.import');
      return;
    }
    const parsed = KnowledgeImportSchema.safeParse(json);
    if (!parsed.success) {
      this.error.set('knowledge.errors.import');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.imported.set(null);
    this.service
      .importDrafts(parsed.data)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ imported }) => {
          this.imported.set(imported);
          this.importText.reset();
          this.page.set(1);
          this.load();
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  change(current: number, previous: number): string {
    if (!previous)
      return current ? 'knowledge.trends.new' : 'knowledge.trends.stable';
    return current === previous
      ? 'knowledge.trends.stable'
      : current > previous
        ? 'knowledge.trends.up'
        : 'knowledge.trends.down';
  }
  percentage(current: number, previous: number): number {
    return previous
      ? Math.round((Math.abs(current - previous) / previous) * 100)
      : 0;
  }
  width(count: number): number {
    return (
      (count /
        Math.max(
          1,
          ...(this.trends()?.areas.map((area) => area.current) ?? [1]),
        )) *
      100
    );
  }

  private fail(error: unknown): void {
    this.loading.set(false);
    this.error.set(knowledgeError(error));
    if (error instanceof HttpErrorResponse && error.status === 401) {
      this.service.session.set(null);
      this.list.set(null);
      this.summary.set(null);
      this.ideas.set(null);
      this.trends.set(null);
      this.editing.set(false);
    }
  }
  private focusPanel(): void {
    afterNextRender(() => this.panelHeading()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }
}
