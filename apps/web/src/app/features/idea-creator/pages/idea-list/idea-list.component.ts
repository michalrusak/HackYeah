import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import {
  AudienceSchema,
  IdeaKindSchema,
  IdeaStageSchema,
  SocialAreaSchema,
  type IdeaSummary,
} from '@repo/api-contracts';
import { debounceTime } from 'rxjs';
import { toErrorKey } from '../../services/api-error';
import { AssistantContextService } from '../../services/assistant-context.service';
import { IdeaCreatorApiService } from '../../services/idea-creator-api.service';

const PAGE_SIZE = 12;

@Component({
  selector: 'app-idea-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    TranslatePipe,
  ],
  templateUrl: './idea-list.component.html',
  styleUrl: './idea-list.component.scss',
})
export class IdeaListComponent implements OnInit {
  private readonly api = inject(IdeaCreatorApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly assistant = inject(AssistantContextService);

  readonly kinds = IdeaKindSchema.options;
  readonly stages = IdeaStageSchema.options;
  readonly audiences = AudienceSchema.options;
  readonly areas = SocialAreaSchema.options;

  readonly filters = new FormGroup({
    q: new FormControl('', { nonNullable: true }),
    kind: new FormControl('', { nonNullable: true }),
    stage: new FormControl('', { nonNullable: true }),
    audience: new FormControl('', { nonNullable: true }),
    area: new FormControl('', { nonNullable: true }),
  });

  readonly items = signal<IdeaSummary[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly pageSize = PAGE_SIZE;
  readonly loading = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly isEmpty = computed(() => !this.loading() && this.items().length === 0);

  constructor() {
    this.assistant.set(undefined, '');
    this.filters.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(0);
        this.load();
      });
  }

  ngOnInit(): void {
    this.load();
  }

  changePage(event: PageEvent): void {
    this.page.set(event.pageIndex);
    this.load();
  }

  visualUrl(item: IdeaSummary): string | null {
    return item.visualId ? this.api.visualUrl(item.id, item.visualId) : null;
  }

  private load(): void {
    this.loading.set(true);
    this.errorKey.set(null);
    const value = this.filters.getRawValue();
    this.api
      .listIdeas({
        q: value.q,
        kind: value.kind || undefined,
        stage: value.stage || undefined,
        audience: value.audience || undefined,
        area: value.area || undefined,
        page: this.page() + 1,
        pageSize: this.pageSize,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.items.set(data.items);
          this.total.set(data.total);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.errorKey.set(toErrorKey(error));
          this.loading.set(false);
        },
      });
  }
}
