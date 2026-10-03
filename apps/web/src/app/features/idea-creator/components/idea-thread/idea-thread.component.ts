import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import type { IdeaMessage, IdeaStatus } from '@repo/api-contracts';
import { toErrorKey } from '../../services/api-error';
import { IdeaCreatorApiService } from '../../services/idea-creator-api.service';

/** Rozmowa autora z ROPS o jednym pomyśle — widoczna tylko dla właściciela fiszki. */
@Component({
  selector: 'app-idea-thread',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    TranslatePipe,
  ],
  templateUrl: './idea-thread.component.html',
  styleUrl: './idea-thread.component.scss',
})
export class IdeaThreadComponent implements OnInit {
  private readonly api = inject(IdeaCreatorApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly ideaId = input.required<string>();
  readonly token = input<string>();
  readonly status = input.required<IdeaStatus>();

  readonly messages = signal<IdeaMessage[]>([]);
  readonly errorKey = signal<string | null>(null);
  readonly sending = signal(false);
  readonly content = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(2000)],
  });

  ngOnInit(): void {
    this.api
      .getThread(this.ideaId(), this.token())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.messages.set(data.messages),
        error: (error: unknown) => this.errorKey.set(toErrorKey(error)),
      });
  }

  send(): void {
    const content = this.content.value.trim();
    if (this.sending()) return;
    if (!content || this.content.invalid) {
      this.content.markAsTouched();
      return;
    }
    this.sending.set(true);
    this.errorKey.set(null);
    this.api
      .sendThreadMessage(this.ideaId(), content, this.token())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.messages.set(data.messages);
          this.content.reset();
          this.sending.set(false);
        },
        error: (error: unknown) => {
          this.errorKey.set(toErrorKey(error));
          this.sending.set(false);
        },
      });
  }
}
