import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import type {
  IdeaDecision,
  ModerationDetailData,
  ModerationListData,
} from '@repo/api-contracts';
import type { Observable } from 'rxjs';
import { KnowledgeService } from './knowledge.service';

/** Kolejka pomysłów zgłoszonych do ROPS: decyzja i odpowiedź autorowi. */
@Component({
  selector: 'app-idea-moderation',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    TranslatePipe,
  ],
  templateUrl: './idea-moderation.component.html',
  styleUrls: ['./knowledge.component.scss', './idea-moderation.component.scss'],
})
export class IdeaModerationComponent {
  private readonly service = inject(KnowledgeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  readonly queue = input.required<ModerationListData>();
  readonly changed = output<void>();

  readonly detail = signal<ModerationDetailData | null>(null);
  readonly busy = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly noticeKey = signal<string | null>(null);
  readonly message = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(2000)],
  });

  open(id: string): void {
    this.noticeKey.set(null);
    this.run(this.service.moderationDetail(id), null);
  }

  close(): void {
    this.detail.set(null);
    this.message.reset();
  }

  decide(decision: IdeaDecision): void {
    const current = this.detail();
    const message = this.message.value.trim();
    if (!current) return;
    if (decision !== 'PUBLISH' && !message) {
      this.errorKey.set('knowledge.admin.ideas.messageRequired');
      return;
    }
    this.run(
      this.service.decideIdea(current.idea.id, { decision, message }),
      `knowledge.admin.ideas.done.${decision}`,
    );
  }

  reply(): void {
    const current = this.detail();
    const message = this.message.value.trim();
    if (!current) return;
    if (!message) {
      this.errorKey.set('knowledge.admin.ideas.messageRequired');
      return;
    }
    this.run(
      this.service.replyToIdea(current.idea.id, message),
      'knowledge.admin.ideas.done.REPLY',
    );
  }

  private run(
    source: Observable<ModerationDetailData>,
    notice: string | null,
  ): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.errorKey.set(null);
    source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.detail.set(data);
        this.busy.set(false);
        if (notice) {
          this.message.reset();
          this.noticeKey.set(notice);
          this.changed.emit();
        }
        afterNextRender(() => this.heading()?.nativeElement.focus(), {
          injector: this.injector,
        });
      },
      error: () => {
        this.errorKey.set('knowledge.admin.ideas.error');
        this.busy.set(false);
      },
    });
  }
}
