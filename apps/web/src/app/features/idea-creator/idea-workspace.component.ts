import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AssistantPanelComponent } from './components/assistant-panel/assistant-panel.component';
import { AssistantContextService } from './services/assistant-context.service';

@Component({
  selector: 'app-idea-workspace',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
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
  readonly sections = [
    { path: '/pomysly', label: 'ideas', icon: 'lightbulb', exact: true },
    { path: '/pomysly/moje', label: 'mine', icon: 'folder_open', exact: false },
    {
      path: '/pomysly/materialy',
      label: 'materials',
      icon: 'menu_book',
      exact: false,
    },
    {
      path: '/pomysly/nabory',
      label: 'calls',
      icon: 'description',
      exact: false,
    },
  ];

  toggle(): void {
    this.open.update((value) => !value);
  }
}
