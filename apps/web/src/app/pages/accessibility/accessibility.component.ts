import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
@Component({
  selector: 'app-accessibility',
  imports: [TranslatePipe, RouterLink],
  template: `<section aria-labelledby="accessibility-title">
    <h1 id="accessibility-title">{{ 'a11y.title' | translate }}</h1>
    <p>{{ 'a11y.scope' | translate }}</p>
    <h2>{{ 'a11y.keyboardTitle' | translate }}</h2>
    <p>{{ 'a11y.keyboard' | translate }}</p>
    <h2>{{ 'a11y.supportTitle' | translate }}</h2>
    <p>{{ 'a11y.support' | translate }}</p>
    <a routerLink="/rops-contact">{{ 'a11y.reportBarrier' | translate }}</a>
  </section>`,
})
export class AccessibilityComponent {}
