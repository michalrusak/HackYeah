import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-about',
  imports: [MatCardModule, TranslatePipe],
  templateUrl: './about.component.html',
})
export class AboutComponent {}
