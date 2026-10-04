import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import {
  AudienceSchema,
  KnowledgeInputSchema,
  KnowledgeKindSchema,
  KnowledgeScopeSchema,
  KnowledgeStatusSchema,
  NeedSchema,
  SocialAreaSchema,
  type KnowledgeResource,
} from '@repo/api-contracts';
import { KnowledgeService } from './knowledge.service';
import { knowledgeError } from './knowledge-error';

@Component({
  selector: 'app-resource-editor',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    TranslatePipe,
  ],
  templateUrl: './resource-editor.component.html',
  styleUrl: './knowledge.component.scss',
})
export class ResourceEditorComponent {
  private readonly service = inject(KnowledgeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  readonly resource = input<KnowledgeResource | null>(null);
  readonly saved = output<KnowledgeResource>();
  readonly cancelled = output<void>();
  readonly kinds = KnowledgeKindSchema.options;
  readonly scopes = KnowledgeScopeSchema.options;
  readonly statuses = KnowledgeStatusSchema.options;
  readonly areas = SocialAreaSchema.options;
  readonly audiences = AudienceSchema.options;
  readonly needs = NeedSchema.options;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = new FormGroup({
    id: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/^[a-z0-9][a-z0-9-]{0,79}$/),
      ],
    }),
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(180)],
    }),
    summary: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(2000)],
    }),
    kind: new FormControl('education', { nonNullable: true }),
    scope: new FormControl('general', { nonNullable: true }),
    status: new FormControl('draft', { nonNullable: true }),
    areas: new FormControl<string[]>([], {
      nonNullable: true,
      validators: [Validators.required],
    }),
    audiences: new FormControl<string[]>([], { nonNullable: true }),
    needs: new FormControl<string[]>([], { nonNullable: true }),
    sourceUrl: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    sourceLabel: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    verifiedAt: new FormControl(new Date().toISOString().slice(0, 10), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    publicationYear: new FormControl<number | null>(null),
    videoPageUrl: new FormControl('', { nonNullable: true }),
    videoUrl: new FormControl('', { nonNullable: true }),
    facts: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    afterNextRender(() => this.heading()?.nativeElement.focus());
    effect(() => {
      const resource = this.resource();
      if (resource) {
        this.form.setValue({
          id: resource.id,
          title: resource.title,
          summary: resource.summary,
          kind: resource.kind,
          scope: resource.scope,
          status: resource.status,
          areas: resource.areas,
          audiences: resource.audiences,
          needs: resource.needs,
          sourceUrl: resource.sourceUrl,
          sourceLabel: resource.sourceLabel,
          verifiedAt: resource.verifiedAt,
          publicationYear: resource.publicationYear,
          videoPageUrl: resource.videoPageUrl ?? '',
          videoUrl: resource.videoUrl ?? '',
          facts: resource.facts
            .map((fact) => `${fact.value} | ${fact.label}`)
            .join('\n'),
        });
        this.form.controls.id.disable();
      }
    });
  }

  save(): void {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    const values = this.form.getRawValue();
    const parsed = KnowledgeInputSchema.safeParse({
      ...values,
      videoPageUrl: values.videoPageUrl.trim() || null,
      videoUrl: values.videoUrl.trim() || null,
      facts: values.facts
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const [value = '', ...label] = line.split('|');
          return { value, label: label.join('|') };
        }),
    });
    if (this.form.invalid || !parsed.success) {
      this.error.set('knowledge.errors.validation');
      return;
    }
    this.saving.set(true);
    this.form.disable({ emitEvent: false });
    this.error.set(null);
    this.service
      .save(parsed.data, this.resource()?.revision ?? null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resource) => {
          this.finish();
          this.saved.emit(resource);
        },
        error: (error: unknown) => {
          this.finish();
          this.error.set(knowledgeError(error));
        },
      });
  }
  private finish(): void {
    this.saving.set(false);
    this.form.enable({ emitEvent: false });
    if (this.resource()) this.form.controls.id.disable({ emitEvent: false });
  }
}
