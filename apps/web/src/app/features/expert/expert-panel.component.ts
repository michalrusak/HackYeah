import { DatePipe } from '@angular/common';
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
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import type {
  ExpertIdeaDetailData,
  ExpertIdeaListData,
  ExpertQueueData,
  ExpertThreadData,
} from '@repo/api-contracts';
import {
  catchError,
  EMPTY,
  filter,
  forkJoin,
  interval,
  of,
  switchMap,
  type Observable,
} from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { projectAccount } from '../testers/projects/project-dialog-access';
import { ExpertService } from './expert.service';

/** Sprawy i pomysły z dziedzin eksperta: szybka odpowiedź i opinia. */
@Component({
  selector: 'app-expert-panel',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    RouterLink,
    TranslatePipe,
  ],
  templateUrl: './expert-panel.component.html',
  styleUrls: [
    '../knowledge/knowledge.component.scss',
    '../knowledge/idea-moderation.component.scss',
  ],
})
export class ExpertPanelComponent {
  readonly auth = inject(AuthService);
  private readonly service = inject(ExpertService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  readonly checking = signal(true);
  readonly busy = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly noticeKey = signal<string | null>(null);
  readonly tab = signal<'conversations' | 'ideas'>('conversations');
  readonly queue = signal<ExpertQueueData | null>(null);
  readonly ideas = signal<ExpertIdeaListData | null>(null);
  readonly ideaCount = computed(() => this.ideas()?.items.length ?? 0);
  readonly thread = signal<ExpertThreadData | null>(null);
  readonly idea = signal<ExpertIdeaDetailData | null>(null);
  readonly message = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(4000)],
  });

  constructor() {
    this.auth
      .refresh()
      .pipe(
        switchMap(({ user }) => (user?.expert ? this.lists() : of(null))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (data) => {
          if (data) this.show(data);
          this.checking.set(false);
        },
        error: () => {
          this.errorKey.set('expert.error');
          this.checking.set(false);
        },
      });
  }

  /** Nowe sprawy pojawiają się same, gdy panel jest otwarty. */
  private readonly poll = interval(30_000)
    .pipe(
      filter(() => !!this.auth.user()?.expert && !this.busy()),
      switchMap(() => this.lists().pipe(catchError(() => EMPTY))),
      takeUntilDestroyed(this.destroyRef),
    )
    .subscribe((data) => this.show(data));

  login(): void {
    projectAccount(this.dialog, this.auth)
      .pipe(
        filter(() => !!this.auth.user()?.expert),
        switchMap(() => this.lists()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (data) => this.show(data),
        error: () => this.errorKey.set('expert.error'),
      });
  }

  select(tab: 'conversations' | 'ideas'): void {
    this.tab.set(tab);
    this.close();
  }

  close(): void {
    this.thread.set(null);
    this.idea.set(null);
    this.message.reset();
    this.errorKey.set(null);
    this.noticeKey.set(null);
  }

  openThread(id: string): void {
    this.noticeKey.set(null);
    this.message.reset();
    this.runThread(this.service.thread(id), null);
  }

  assign(action: 'take' | 'release'): void {
    const current = this.thread();
    if (!current) return;
    this.runThread(
      this.service.assign(current.conversation.id, action),
      `expert.done.${action}`,
    );
  }

  reply(): void {
    const current = this.thread();
    const content = this.content();
    if (!current || !content) return;
    this.runThread(
      this.service.reply(current.conversation.id, content),
      'expert.done.reply',
    );
  }

  openIdea(id: string): void {
    this.noticeKey.set(null);
    this.message.reset();
    this.runIdea(this.service.idea(id), null);
  }

  addOpinion(): void {
    const current = this.idea();
    const content = this.content();
    if (!current || !content) return;
    // Wątek pomysłu przyjmuje krótsze wpisy niż rozmowa.
    if (content.length > 2000) {
      this.errorKey.set('expert.opinionTooLong');
      return;
    }
    this.runIdea(
      this.service.opinion(current.idea.id, content),
      'expert.done.opinion',
    );
  }

  private content(): string | null {
    const content = this.message.value.trim();
    if (!content || this.message.invalid) {
      this.errorKey.set('expert.messageRequired');
      return null;
    }
    return content;
  }

  private lists(): Observable<{
    queue: ExpertQueueData;
    ideas: ExpertIdeaListData;
  }> {
    return forkJoin({
      queue: this.service.conversations(),
      ideas: this.service.ideas(),
    });
  }

  private show(data: {
    queue: ExpertQueueData;
    ideas: ExpertIdeaListData;
  }): void {
    this.queue.set(data.queue);
    this.ideas.set(data.ideas);
  }

  private runThread(
    source: Observable<ExpertThreadData>,
    notice: string | null,
  ): void {
    this.run(source, notice, (data) => this.thread.set(data));
  }

  private runIdea(
    source: Observable<ExpertIdeaDetailData>,
    notice: string | null,
  ): void {
    this.run(source, notice, (data) => this.idea.set(data));
  }

  private run<T>(
    source: Observable<T>,
    notice: string | null,
    apply: (data: T) => void,
  ): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.errorKey.set(null);
    source
      .pipe(
        switchMap((data) =>
          // Po zmianie odświeżamy też listy, żeby liczniki były aktualne.
          notice
            ? this.lists().pipe(switchMap((lists) => of({ data, lists })))
            : of({ data, lists: null }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ data, lists }) => {
          apply(data);
          if (lists) this.show(lists);
          this.busy.set(false);
          if (notice) {
            this.message.reset();
            this.noticeKey.set(notice);
          }
          afterNextRender(() => this.heading()?.nativeElement.focus(), {
            injector: this.injector,
          });
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.errorKey.set(
            error instanceof HttpErrorResponse && error.status === 409
              ? 'expert.taken'
              : 'expert.error',
          );
        },
      });
  }
}
