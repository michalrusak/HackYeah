import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-contact',
  imports: [MatCardModule],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Kontakt</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p>Placeholder — email, social media, formularz kontaktowy.</p>
      </mat-card-content>
    </mat-card>
  `,
})
export class ContactComponent {}
