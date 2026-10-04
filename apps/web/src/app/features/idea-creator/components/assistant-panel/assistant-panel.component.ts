import {
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslatePipe } from '@ngx-translate/core';
import type { WildcardVariant } from '@repo/api-contracts';
import { toErrorKey } from '../../services/api-error';
import { IdeaCreatorApiService } from '../../services/idea-creator-api.service';

interface ChatEntry {
  role: 'user' | 'assistant';
  content: string;
}

@Component({
  selector: 'app-assistant-panel',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTabsModule,
    TranslatePipe,
  ],
  templateUrl: './assistant-panel.component.html',
  styleUrl: './assistant-panel.component.scss',
})
export class AssistantPanelComponent {
  readonly ideaId = input<string | undefined>(undefined);
  /** Opis pomysłu używany przy generowaniu nietuzinkowych wariantów. */
  readonly seed = input<string>('');

  private readonly api = inject(IdeaCreatorApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly message = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(2000)],
  });
  readonly entries = signal<ChatEntry[]>([]);
  readonly followUps = signal<string[]>([]);
  readonly variants = signal<WildcardVariant[]>([]);
  readonly chatLoading = signal(false);
  readonly variantsLoading = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly canSuggestVariants = computed(() => this.seed().trim().length >= 10);

  send(text?: string): void {
    const content = (text ?? this.message.value).trim();
    if (content.length === 0 || content.length > 2000 || this.chatLoading())
      return;
    this.errorKey.set(null);
    this.followUps.set([]);
    this.entries.update((current) => [...current, { role: 'user', content }]);
    this.message.setValue('');
    this.chatLoading.set(true);
    this.api
      .assistantChat(content, this.ideaId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.entries.update((current) => [
            ...current,
            { role: 'assistant', content: data.reply },
          ]);
          this.followUps.set(data.followUps);
          this.chatLoading.set(false);
        },
        error: (error: unknown) => {
          this.errorKey.set(toErrorKey(error));
          this.chatLoading.set(false);
        },
      });
  }

  loadVariants(): void {
    if (this.variantsLoading() || !this.canSuggestVariants()) return;
    this.errorKey.set(null);
    this.variantsLoading.set(true);
    this.api
      .assistantWildcards(this.seed().trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.variants.set(data.variants);
          this.variantsLoading.set(false);
        },
        error: (error: unknown) => {
          this.errorKey.set(toErrorKey(error));
          this.variantsLoading.set(false);
        },
      });
  }
}
