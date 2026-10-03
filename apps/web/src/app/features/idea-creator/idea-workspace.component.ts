import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AssistantPanelComponent } from './components/assistant-panel/assistant-panel.component';
import { AssistantContextService } from './services/assistant-context.service';

@Component({
  selector: 'app-idea-workspace',
  imports: [
    RouterOutlet,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    TranslatePipe,
    AssistantPanelComponent,
  ],
  templateUrl: './idea-workspace.component.html',
  styleUrl: './idea-workspace.component.scss',
})
export class IdeaWorkspaceComponent {
  readonly context = inject(AssistantContextService);
  readonly open = signal(false);

  toggle(): void {
    this.open.update((value) => !value);
  }
}
