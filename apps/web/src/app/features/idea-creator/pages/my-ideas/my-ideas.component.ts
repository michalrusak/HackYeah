import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import type { Idea } from '@repo/api-contracts';
import { AssistantContextService } from '../../services/assistant-context.service';
import { EditTokenStore } from '../../services/edit-token.store';
import { IdeaCreatorApiService } from '../../services/idea-creator-api.service';

/**
 * Zastępuje listę „moje konto” — źródłem prawdy są tokeny edycji zapisane
 * w przeglądarce, bo moduł działa bez logowania.
 */
@Component({
  selector: 'app-my-ideas',
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    TranslatePipe,
  ],
  templateUrl: './my-ideas.component.html',
  styleUrl: './my-ideas.component.scss',
})
export class MyIdeasComponent {
  readonly store = inject(EditTokenStore);
  /** Stan weryfikacji i oznaczenie nowej odpowiedzi ROPS dla zapisanych fiszek. */
  readonly states = signal<Record<string, Idea>>({});

  constructor() {
    inject(AssistantContextService).clear();
    const api = inject(IdeaCreatorApiService);
    const destroyRef = inject(DestroyRef);
    for (const entry of this.store.ideas()) {
      api
        .getIdea(entry.id, entry.token)
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe({
          next: ({ idea }) =>
            this.states.update((current) => ({ ...current, [idea.id]: idea })),
          // Usunięta fiszka zostaje na liście bez stanu.
          error: () => undefined,
        });
    }
  }

  forget(ideaId: string): void {
    this.store.forgetIdea(ideaId);
  }
}
