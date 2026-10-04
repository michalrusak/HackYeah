import { DatePipe } from '@angular/common';
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
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import {
  ContactCategorySchema,
  type ContactCategory,
  type ContactConversation,
  type ContactThreadData,
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
import { ContactDraftService } from '../../core/services/contact-draft.service';
import { projectAccount } from '../testers/projects/project-dialog-access';
import { RopsContactService } from './rops-contact.service';

@Component({
  selector: 'app-rops-contact',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    TranslatePipe,
  ],
  templateUrl: './rops-contact.component.html',
  styleUrls: ['./rops-contact.component.scss'],
})
export class RopsContactComponent {
  readonly auth = inject(AuthService);
  private readonly service = inject(RopsContactService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly conversationHeading = viewChild<ElementRef<HTMLElement>>(
    'conversationHeading',
  );

  readonly categories = ContactCategorySchema.options;
  readonly checking = signal(true);
  readonly busy = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly statusKey = signal<string | null>(null);
  readonly conversations = signal<ContactConversation[]>([]);
  readonly thread = signal<ContactThreadData | null>(null);
  readonly openId = computed(() => this.thread()?.conversation.id ?? null);
  readonly creating = signal(false);

  readonly form = new FormGroup({
    firstName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    lastName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    organization: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(200)],
    }),
    category: new FormControl<ContactCategory>('QUESTION', {
      nonNullable: true,
    }),
    subject: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    message: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(4000)],
    }),
  });
  readonly reply = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(4000)],
  });

  constructor() {
    const draft = inject(ContactDraftService).take();
    if (draft) {
      this.form.patchValue({ subject: draft.subject, message: draft.body });
      this.creating.set(true);
    }
    this.auth
      .refresh()
      .pipe(
        switchMap(({ user }) =>
          user ? this.service.conversations() : of({ items: [] }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ items }) => {
          this.conversations.set(items);
          this.checking.set(false);
        },
        error: () => {
          this.errorKey.set('a11y.loadError');
          this.checking.set(false);
        },
      });
  }

  /** Odpowiedź ROPS pojawia się sama, gdy ekran jest otwarty. */
  private readonly poll = interval(30_000)
    .pipe(
      filter(() => this.auth.user() !== null && !this.busy()),
      switchMap(() => {
        const open = this.thread()?.conversation.id;
        return forkJoin({
          list: this.service.conversations(),
          thread: open ? this.service.thread(open) : of(null),
        }).pipe(catchError(() => EMPTY));
      }),
      takeUntilDestroyed(this.destroyRef),
    )
    .subscribe(({ list, thread }) => {
      this.conversations.set(list.items);
      if (thread && thread.conversation.id === this.thread()?.conversation.id)
        this.thread.set(thread);
    });

  login(): void {
    projectAccount(this.dialog, this.auth)
      .pipe(
        filter(Boolean),
        switchMap(() => this.service.conversations()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ items }) => this.conversations.set(items),
        error: () => this.errorKey.set('a11y.loadError'),
      });
  }

  logout(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.auth
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.conversations.set([]);
          this.thread.set(null);
          this.creating.set(false);
          this.errorKey.set(null);
          this.statusKey.set(null);
        },
        error: () => this.fail('rops-contact.error'),
      });
  }

  startNew(): void {
    this.thread.set(null);
    this.creating.set(true);
    this.errorKey.set(null);
    this.focus('input[formControlName=firstName]');
  }

  open(conversation: ContactConversation): void {
    this.creating.set(false);
    this.reply.reset();
    this.run(this.service.thread(conversation.id), 'loading', () =>
      afterNextRender(() => this.conversationHeading()?.nativeElement.focus(), {
        injector: this.injector,
      }),
    );
  }

  create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorKey.set('a11y.contactValidation');
      this.focus('input.ng-invalid, textarea.ng-invalid');
      return;
    }
    const { message, ...value } = this.form.getRawValue();
    this.run(
      this.service.create({ ...value, initialMessage: message }),
      'sending',
      () => {
        this.creating.set(false);
        this.form.reset();
      },
    );
  }

  send(): void {
    const current = this.thread();
    const content = this.reply.value.trim();
    if (!current || !content || this.reply.invalid) return;
    this.run(
      this.service.send(current.conversation.id, content),
      'sending',
      () => this.reply.reset(),
    );
  }

  private run(
    source: Observable<ContactThreadData>,
    kind: 'loading' | 'sending',
    done: () => void,
  ): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.errorKey.set(null);
    this.statusKey.set(`a11y.${kind}`);
    source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.busy.set(false);
        this.thread.set(data);
        this.conversations.update((items) => [
          data.conversation,
          ...items.filter((item) => item.id !== data.conversation.id),
        ]);
        this.statusKey.set(kind === 'sending' ? 'a11y.sent' : null);
        done();
      },
      error: () =>
        this.fail(kind === 'sending' ? 'a11y.sendError' : 'a11y.loadError'),
    });
  }

  private fail(key: string): void {
    this.busy.set(false);
    this.statusKey.set(null);
    this.errorKey.set(key);
  }

  private focus(selector: string): void {
    afterNextRender(
      () =>
        this.element.nativeElement
          .querySelector<HTMLElement>(selector)
          ?.focus(),
      { injector: this.injector },
    );
  }
}
