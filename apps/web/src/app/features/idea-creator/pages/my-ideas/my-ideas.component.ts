import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AssistantContextService } from '../../services/assistant-context.service';
import { EditTokenStore } from '../../services/edit-token.store';

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

  constructor() {
    inject(AssistantContextService).clear();
  }

  forget(ideaId: string): void {
    this.store.forgetIdea(ideaId);
  }
}
