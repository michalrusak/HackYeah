import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import {
  KnowledgeQuerySchema,
  SocialAreaSchema,
  type KnowledgeResource,
  type SocialArea,
} from '@repo/api-contracts';
import { catchError, map, merge, of, Subject, switchMap, tap } from 'rxjs';
import { AREA_ICONS } from './knowledge-areas';
import { knowledgeError } from './knowledge-error';
import { KnowledgeService } from './knowledge.service';
import { ResourceCardComponent } from './resource-card.component';

type Topic = Record<KnowledgeResource['kind'], KnowledgeResource[]>;

@Component({
  selector: 'app-knowledge-topic',
  imports: [
    RouterLink,
    TranslatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    ResourceCardComponent,
  ],
  templateUrl: './knowledge-topic.component.html',
  styleUrls: ['./knowledge.component.scss', './knowledge-topic.component.scss'],
})
export class KnowledgeTopicComponent {
  private readonly service = inject(KnowledgeService);
  private readonly route = inject(ActivatedRoute);
  private readonly refresh = new Subject<void>();
  readonly icons = AREA_ICONS;
  readonly area = signal<SocialArea | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly topic = signal<Topic | null>(null);

  constructor() {
    merge(
      this.route.paramMap,
      this.refresh.pipe(map(() => this.route.snapshot.paramMap)),
    )
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
          this.topic.set(null);
        }),
        switchMap((params) => {
          const area = SocialAreaSchema.safeParse(params.get('area'));
          this.area.set(area.success ? area.data : null);
          if (!area.success) {
            this.error.set('knowledge.topic.unknown');
            return of(null);
          }
          return this.service
            .list(KnowledgeQuerySchema.parse({ area: area.data, pageSize: 30 }))
            .pipe(
              catchError((error: unknown) => {
                this.error.set(knowledgeError(error));
                return of(null);
              }),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((list) => {
        this.loading.set(false);
        if (!list) return;
        const of = (kind: KnowledgeResource['kind']): KnowledgeResource[] =>
          list.resources.filter((item) => item.kind === kind);
        this.topic.set({
          challenge: of('challenge'),
          innovation: of('innovation'),
          report: of('report'),
          education: of('education'),
        });
      });
  }

  retry(): void {
    this.refresh.next();
  }
}
