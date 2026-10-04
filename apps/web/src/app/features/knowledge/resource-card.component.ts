import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { youtubeId, type KnowledgeResource } from '@repo/api-contracts';
import { AREA_ICONS } from './knowledge-areas';

@Component({
  selector: 'app-resource-card',
  imports: [
    DatePipe,
    TranslatePipe,
    MatButtonModule,
    MatIconModule,
    RouterLink,
  ],
  templateUrl: './resource-card.component.html',
  styleUrls: ['./knowledge.component.scss', './resource-card.component.scss'],
})
export class ResourceCardComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly injector = inject(Injector);
  private readonly player = viewChild<ElementRef<HTMLElement>>('player');
  readonly resource = input.required<KnowledgeResource>();
  readonly playing = signal(false);
  readonly icons = AREA_ICONS;
  readonly videoId = computed(() => youtubeId(this.resource().videoUrl));
  // Identyfikator przeszedł walidację youtubeId (11 znaków [\w-]), więc adres jest zaufany.
  readonly embedUrl = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${this.videoId()}?autoplay=1`,
    ),
  );

  play(): void {
    this.playing.set(true);
    afterNextRender(() => this.player()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }
}
