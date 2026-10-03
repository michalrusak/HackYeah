import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { type TesterMatch, type TesterProfile } from '@repo/api-contracts';

@Component({
  selector: 'app-tester-card',
  imports: [MatButtonModule, MatIconModule, TranslatePipe],
  templateUrl: './tester-card.component.html',
  styleUrl: './tester-card.component.scss',
})
export class TesterCardComponent {
  readonly profile = input.required<TesterProfile>();
  readonly match = input<TesterMatch | null>(null);
  readonly assigned = input(false);
  readonly busy = input(false);
  readonly toggleAssignment = output<void>();
  readonly initials = computed(() =>
    this.profile()
      .displayName.split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toLocaleUpperCase('pl'),
  );
  readonly traits = computed(() =>
    [...new Set([...this.profile().skills, ...this.profile().resources])].slice(0, 5),
  );
}
