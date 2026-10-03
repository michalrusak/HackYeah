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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import type { CanvasAnswers, CanvasField } from '@repo/api-contracts';
import { debounceTime, forkJoin } from 'rxjs';
import { toErrorKey } from '../../services/api-error';
import { AssistantContextService } from '../../services/assistant-context.service';
import { EditTokenStore } from '../../services/edit-token.store';
import { IdeaCreatorApiService } from '../../services/idea-creator-api.service';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

@Component({
  selector: 'app-idea-canvas',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    TranslatePipe,
  ],
  templateUrl: './idea-canvas.component.html',
  styleUrl: './idea-canvas.component.scss',
})
export class IdeaCanvasComponent implements OnInit {
  private readonly api = inject(IdeaCreatorApiService);
  private readonly tokens = inject(EditTokenStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly assistant = inject(AssistantContextService);

  readonly ideaId = computed(() => this.route.snapshot.paramMap.get('id') ?? '');
  readonly token = computed(() => this.tokens.ideaToken(this.ideaId()));
  readonly isOwner = computed(() => Boolean(this.token()));

  readonly fields = signal<CanvasField[]>([]);
  readonly form = new FormGroup<Record<string, FormControl<string>>>({});
  readonly loading = signal(true);
  readonly suggesting = signal(false);
  readonly saveState = signal<SaveState>('idle');
  readonly errorKey = signal<string | null>(null);
  readonly title = signal('');
  readonly description = signal('');

  readonly columns = computed(() => {
    const grouped = new Map<number, CanvasField[]>();
    for (const field of this.fields()) {
      const bucket = grouped.get(field.column) ?? [];
      bucket.push(field);
      grouped.set(field.column, bucket);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => a - b)
      .map(([column, fields]) => ({
        column,
        fields: fields.sort((a, b) => a.order - b.order),
      }));
  });

  ngOnInit(): void {
    forkJoin({
      template: this.api.canvasTemplate(),
      canvas: this.api.getCanvas(this.ideaId(), this.token()),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ template, canvas }) => {
          this.title.set(template.template.title);
          this.description.set(template.template.description);
          this.fields.set(template.template.fields);
          for (const field of template.template.fields) {
            const control = new FormControl(canvas.answers[field.id] ?? '', {
              nonNullable: true,
            });
            if (!this.isOwner()) control.disable({ emitEvent: false });
            this.form.addControl(field.id, control);
          }
          this.watchChanges();
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.errorKey.set(toErrorKey(error));
          this.loading.set(false);
        },
      });

    this.api
      .getIdea(this.ideaId(), this.token())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) =>
          this.assistant.set(
            data.idea.id,
            `${data.idea.title}. ${data.idea.essence} ${data.idea.problem}`,
          ),
        error: () => this.assistant.clear(),
      });
  }

  remaining(field: CanvasField): number {
    return field.maxLength - (this.form.controls[field.id]?.value.length ?? 0);
  }

  suggest(): void {
    if (this.suggesting() || !this.isOwner()) return;
    this.suggesting.set(true);
    this.errorKey.set(null);
    this.api
      .suggestCanvas(this.ideaId(), this.token())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          // Propozycje nie nadpisują tego, co użytkownik już napisał.
          for (const suggestion of data.suggestions) {
            const control = this.form.controls[suggestion.fieldId];
            if (control && control.value.trim().length === 0) {
              control.setValue(suggestion.content);
            }
          }
          this.suggesting.set(false);
        },
        error: (error: unknown) => {
          this.errorKey.set(toErrorKey(error));
          this.suggesting.set(false);
        },
      });
  }

  private watchChanges(): void {
    if (!this.isOwner()) return;
    this.form.valueChanges
      .pipe(debounceTime(1200), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.save());
  }

  private save(): void {
    const answers = this.form.getRawValue() as CanvasAnswers;
    this.saveState.set('saving');
    this.api
      .saveCanvas(this.ideaId(), answers, this.token())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.saveState.set('saved'),
        error: (error: unknown) => {
          this.errorKey.set(toErrorKey(error));
          this.saveState.set('error');
        },
      });
  }
}
