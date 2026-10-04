import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import {
  AudienceSchema,
  KnowledgeKindSchema,
  KnowledgeQuerySchema,
  KnowledgeScopeSchema,
  SocialAreaSchema,
  type KnowledgeList,
  type KnowledgeOverview,
  type KnowledgeQuery,
} from '@repo/api-contracts';
import {
  catchError,
  forkJoin,
  map,
  merge,
  of,
  Subject,
  switchMap,
  tap,
} from 'rxjs';
import { AREA_ICONS } from './knowledge-areas';
import { KnowledgeService } from './knowledge.service';
import { knowledgeError } from './knowledge-error';
import { ResourceCardComponent } from './resource-card.component';

@Component({
  selector: 'app-knowledge',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatProgressBarModule,
    ResourceCardComponent,
  ],
  templateUrl: './knowledge.component.html',
  styleUrl: './knowledge.component.scss',
})
export class KnowledgeComponent {
  private readonly service = inject(KnowledgeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly resultsHeading =
    viewChild<ElementRef<HTMLElement>>('resultsHeading');
  private focusResults = false;
  private readonly refresh = new Subject<void>();
  readonly kinds = KnowledgeKindSchema.options;
  readonly scopes = KnowledgeScopeSchema.options;
  readonly audiences = AudienceSchema.options;
  readonly areas = SocialAreaSchema.options;
  readonly icons = AREA_ICONS;
  readonly form = new FormGroup({
    q: new FormControl('', { nonNullable: true }),
    area: new FormControl('', { nonNullable: true }),
    audience: new FormControl('', { nonNullable: true }),
    kind: new FormControl('', { nonNullable: true }),
    scope: new FormControl('', { nonNullable: true }),
    video: new FormControl('', { nonNullable: true }),
  });
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly result = signal<KnowledgeList | null>(null);
  readonly overview = signal<KnowledgeOverview | null>(null);
  readonly query = signal<KnowledgeQuery>(KnowledgeQuerySchema.parse({}));

  constructor() {
    merge(
      this.route.queryParamMap,
      this.refresh.pipe(map(() => this.route.snapshot.queryParamMap)),
    )
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
          this.result.set(null);
        }),
        switchMap((params) => {
          const parsed = KnowledgeQuerySchema.safeParse({
            q: params.get('q') ?? '',
            area: params.get('area') ?? undefined,
            kind: params.get('kind') ?? undefined,
            audience: params.get('audience') ?? undefined,
            scope: params.get('scope') ?? undefined,
            video: params.get('video') ?? undefined,
            page: params.get('page') ?? 1,
          });
          if (!parsed.success) {
            this.error.set('knowledge.errors.validation');
            return of(null);
          }
          const query = parsed.data;
          this.query.set(query);
          this.form.setValue({
            q: query.q,
            area: query.area ?? '',
            kind: query.kind ?? '',
            audience: query.audience ?? '',
            scope: query.scope ?? '',
            video: query.video ?? '',
          });
          return forkJoin({
            list: this.service.list(query),
            overview: this.service.overview(),
          }).pipe(
            catchError((error: unknown) => {
              this.error.set(knowledgeError(error));
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => {
        this.loading.set(false);
        if (data) {
          this.result.set(data.list);
          this.overview.set(data.overview);
        }
        if (this.focusResults)
          afterNextRender(() => this.resultsHeading()?.nativeElement.focus(), {
            injector: this.injector,
          });
        this.focusResults = false;
      });
  }

  search(): void {
    this.focusResults = true;
    const values = this.form.getRawValue();
    this.navigate(
      Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== ''),
      ),
    );
  }

  selectKind(kind: string): void {
    this.form.controls.kind.setValue(
      this.form.controls.kind.value === kind ? '' : kind,
    );
    this.search();
  }
  toggleVideo(): void {
    this.form.controls.video.setValue(
      this.form.controls.video.value ? '' : '1',
    );
    this.search();
  }
  clear(): void {
    this.form.reset();
    this.focusResults = true;
    this.navigate({});
  }
  page(direction: number): void {
    this.focusResults = true;
    this.navigate({ ...this.query(), page: this.query().page + direction });
  }
  retry(): void {
    this.search();
  }
  count(area: string): number {
    return (
      this.overview()?.areas.find((item) => item.area === area)?.count ?? 0
    );
  }
  private navigate(queryParams: Record<string, unknown>): void {
    const target = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams,
    });
    if (this.router.serializeUrl(target) === this.router.url)
      this.refresh.next();
    else void this.router.navigateByUrl(target);
  }
}
