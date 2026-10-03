import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-home',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    TranslatePipe,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly api = inject(ApiService);

  readonly apiMessage = signal<string | null>(null);
  readonly dbStatus = signal<string | null>(null);
  readonly apiError = signal(false);

  constructor() {
    this.api.getHello().subscribe({
      next: (data) => this.apiMessage.set(data.message),
      error: () => this.apiError.set(true),
    });

    this.api.getHealth().subscribe({
      next: (data) => this.dbStatus.set(data.database),
      error: () => this.apiError.set(true),
    });
  }
}
