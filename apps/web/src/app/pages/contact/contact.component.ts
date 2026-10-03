import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-contact',
  imports: [MatCardModule, TranslatePipe],
  templateUrl: './contact.component.html',
})
export class ContactComponent {}
