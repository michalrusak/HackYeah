import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
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
import {
  ContactCategorySchema,
  type ContactCategory,
  type ContactQueueData,
  type ContactThreadData,
} from '@repo/api-contracts';
import type { Observable } from 'rxjs';
import { KnowledgeService } from './knowledge.service';

/** Skrzynka ROPS: pytania, prośby o mentora i propozycje partnerstw. */
@Component({
  selector: 'app-contact-inbox',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    TranslatePipe,
  ],
  templateUrl: './contact-inbox.component.html',
  styleUrls: ['./knowledge.component.scss', './idea-moderation.component.scss'],
})
export class ContactInboxComponent {
  private readonly service = inject(KnowledgeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  readonly queue = input.required<ContactQueueData>();
  readonly changed = output<void>();

  readonly filters = ['ALL', ...ContactCategorySchema.options] as const;
  readonly category = signal<ContactCategory | 'ALL'>('ALL');
  readonly items = computed(() => {
    const category = this.category();
    return this.queue().items.filter(
      (item) => category === 'ALL' || item.category === category,
    );
  });
  readonly detail = signal<ContactThreadData | null>(null);
  readonly busy = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly noticeKey = signal<string | null>(null);
  readonly message = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(4000)],
  });

  open(id: string): void {
    this.noticeKey.set(null);
    this.run(this.service.contactThread(id), null);
  }

  close(): void {
    this.detail.set(null);
    this.message.reset();
  }

  reply(): void {
    const current = this.detail();
    const message = this.message.value.trim();
    if (!current) return;
    if (!message) {
      this.errorKey.set('knowledge.admin.contact.messageRequired');
      return;
    }
    this.run(
      this.service.replyToContact(current.conversation.id, message),
      'knowledge.admin.contact.done.reply',
    );
  }

  finish(): void {
    const current = this.detail();
    if (!current) return;
    this.run(
      this.service.closeContact(current.conversation.id),
      'knowledge.admin.contact.done.close',
    );
  }

  private run(
    source: Observable<ContactThreadData>,
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
        this.errorKey.set('knowledge.admin.contact.error');
        this.busy.set(false);
      },
    });
  }
}
