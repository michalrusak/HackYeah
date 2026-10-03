import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-about',
  imports: [MatCardModule],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>O projekcie</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p>Placeholder — opisz tu swój projekt hackathonowy.</p>
      </mat-card-content>
    </mat-card>
  `,
})
export class AboutComponent {}
