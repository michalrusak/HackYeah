import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class AppComponent {
  constructor() {
    const title = inject(Title);
    inject(TranslateService)
      .get('matchmaking.productName')
      .pipe(takeUntilDestroyed())
      .subscribe((name: string) => title.setTitle(name));
  }
}
