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
import type { ApplicationData, CallSection } from '@repo/api-contracts';
import { debounceTime } from 'rxjs';
import { toErrorKey } from '../../services/api-error';
import { EditTokenStore } from '../../services/edit-token.store';
import { IdeaCreatorApiService } from '../../services/idea-creator-api.service';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

@Component({
  selector: 'app-application',
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
  templateUrl: './application.component.html',
  styleUrl: './application.component.scss',
})
export class ApplicationComponent implements OnInit {
  private readonly api = inject(IdeaCreatorApiService);
  private readonly tokens = inject(EditTokenStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly applicationId = computed(
    () => this.route.snapshot.paramMap.get('applicationId') ?? '',
  );
  readonly token = computed(() =>
    this.tokens.applicationToken(this.applicationId()),
  );

  readonly data = signal<ApplicationData | null>(null);
  readonly form = new FormGroup<Record<string, FormControl<string>>>({});
  readonly loading = signal(true);
  readonly generating = signal(false);
  readonly submitting = signal(false);
  readonly saveState = signal<SaveState>('idle');
  readonly errorKey = signal<string | null>(null);
  readonly submitted = computed(
    () => this.data()?.application.status === 'SUBMITTED',
  );
  readonly sections = computed(() => this.data()?.call.sections ?? []);

  ngOnInit(): void {
    this.load();
  }

  remaining(section: CallSection): number {
    return (
      section.maxLength - (this.form.controls[section.id]?.value.length ?? 0)
    );
  }

  generate(): void {
    if (this.generating() || this.submitted()) return;
    this.generating.set(true);
    this.errorKey.set(null);
    this.api
      .generateApplication(this.applicationId(), this.token())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.apply(data, { silent: true });
          this.generating.set(false);
        },
        error: (error: unknown) => {
          this.errorKey.set(toErrorKey(error));
          this.generating.set(false);
        },
      });
  }

  submit(): void {
    if (this.submitting() || this.submitted()) return;
    this.submitting.set(true);
    this.errorKey.set(null);
    this.api
      .submitApplication(this.applicationId(), this.token())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.apply(data, { silent: true });
          this.submitting.set(false);
        },
        error: (error: unknown) => {
          this.errorKey.set(toErrorKey(error));
          this.submitting.set(false);
        },
      });
  }

  /** Eksport pobiera się przez Blob, żeby nie wystawiać tokenu w adresie URL. */
  exportMarkdown(): void {
    this.api
      .exportApplication(this.applicationId(), this.token())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ filename, markdown }) => {
          const url = URL.createObjectURL(
            new Blob([markdown], { type: 'text/markdown;charset=utf-8' }),
          );
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          link.click();
          URL.revokeObjectURL(url);
        },
        error: (error: unknown) => this.errorKey.set(toErrorKey(error)),
      });
  }

  private load(): void {
    this.api
      .getApplication(this.applicationId(), this.token())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.apply(data, { silent: false });
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.errorKey.set(toErrorKey(error));
          this.loading.set(false);
        },
      });
  }

  private apply(data: ApplicationData, options: { silent: boolean }): void {
    this.data.set(data);
    for (const section of data.call.sections) {
      const value = data.application.answers[section.id] ?? '';
      const existing = this.form.controls[section.id];
      if (existing) {
        existing.setValue(value, { emitEvent: false });
      } else {
        this.form.addControl(
          section.id,
          new FormControl(value, { nonNullable: true }),
          { emitEvent: false },
        );
      }
    }
    if (data.application.status === 'SUBMITTED') {
      this.form.disable({ emitEvent: false });
      return;
    }
    if (!options.silent) this.watchChanges();
  }

  private watchChanges(): void {
    this.form.valueChanges
      .pipe(debounceTime(1500), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.save());
  }

  private save(): void {
    if (this.submitted()) return;
    this.saveState.set('saving');
    this.api
      .saveApplication(this.applicationId(), this.form.getRawValue(), this.token())
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
