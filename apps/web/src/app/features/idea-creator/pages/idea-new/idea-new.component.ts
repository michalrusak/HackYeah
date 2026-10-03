import type { StepperSelectionEvent } from '@angular/cdk/stepper';
import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  AudienceSchema,
  CreateIdeaRequestSchema,
  IdeaKindSchema,
  IdeaStageSchema,
  NeedSchema,
  SocialAreaSchema,
  type Audience,
  type IdeaStage,
  type Need,
  type SocialArea,
} from '@repo/api-contracts';
import { toErrorKey } from '../../services/api-error';
import { AssistantContextService } from '../../services/assistant-context.service';
import { EditTokenStore } from '../../services/edit-token.store';
import { IdeaCreatorApiService } from '../../services/idea-creator-api.service';

@Component({
  selector: 'app-idea-new',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatStepperModule,
    TranslatePipe,
  ],
  templateUrl: './idea-new.component.html',
  styleUrl: './idea-new.component.scss',
})
export class IdeaNewComponent {
  private readonly api = inject(IdeaCreatorApiService);
  private readonly tokens = inject(EditTokenStore);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly assistant = inject(AssistantContextService);

  readonly stepHeadings =
    viewChildren<ElementRef<HTMLElement>>('stepHeading');

  readonly stages = IdeaStageSchema.options;
  readonly kinds = IdeaKindSchema.options;
  readonly audienceOptions = AudienceSchema.options;
  readonly areaOptions = SocialAreaSchema.options;
  readonly needOptions = NeedSchema.options;

  readonly seedForm = new FormGroup({
    seed: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(2000)],
    }),
  });

  readonly coreForm = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(120),
      ],
    }),
    essence: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(10),
        Validators.maxLength(600),
      ],
    }),
    problem: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(10),
        Validators.maxLength(1500),
      ],
    }),
    targetAudience: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(600),
      ],
    }),
  });

  readonly contextForm = new FormGroup({
    stage: new FormControl<IdeaStage>('POMYSL', { nonNullable: true }),
    kind: new FormControl<'IDEA' | 'GOOD_PRACTICE'>('IDEA', {
      nonNullable: true,
    }),
    region: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(120)],
    }),
    contactEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email, Validators.maxLength(200)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(4000)],
    }),
  });

  readonly tagsForm = new FormGroup({
    audiences: new FormControl<Audience[]>([], { nonNullable: true }),
    areas: new FormControl<SocialArea[]>([], { nonNullable: true }),
    needs: new FormControl<Need[]>([], { nonNullable: true }),
  });

  readonly expanding = signal(false);
  readonly saving = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly stepAnnouncement = signal('');
  readonly nextSteps = signal<string[]>([]);

  constructor() {
    this.assistant.set(undefined, '');
    this.seedForm.controls.seed.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.assistant.set(undefined, value));
  }

  /** Zmiana kroku jest ogłaszana czytnikowi i przenosi fokus na nagłówek. */
  onStepChange(event: StepperSelectionEvent): void {
    this.stepAnnouncement.set(
      this.translate.instant('ideaCreator.new.stepAnnouncement', {
        current: event.selectedIndex + 1,
        total: 4,
      }),
    );
    queueMicrotask(() => {
      this.stepHeadings()[event.selectedIndex]?.nativeElement.focus();
    });
  }

  expandWithAssistant(): void {
    const seed = this.seedForm.controls.seed.value.trim();
    if (seed.length < 10 || this.expanding()) return;
    this.expanding.set(true);
    this.errorKey.set(null);
    this.api
      .assistantExpand(seed)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.coreForm.patchValue({
            title: data.title,
            essence: data.essence,
            problem: data.problem,
            targetAudience: data.targetAudience,
          });
          this.contextForm.patchValue({ stage: data.stage });
          this.tagsForm.patchValue({
            audiences: data.audiences,
            areas: data.areas,
            needs: data.needs,
          });
          this.nextSteps.set(data.nextSteps);
          this.expanding.set(false);
        },
        error: (error: unknown) => {
          this.errorKey.set(toErrorKey(error));
          this.expanding.set(false);
        },
      });
  }

  save(publish: boolean): void {
    if (this.saving()) return;
    this.coreForm.markAllAsTouched();
    if (this.coreForm.invalid || this.contextForm.invalid) {
      this.errorKey.set('ideaCreator.errors.validation');
      return;
    }
    const parsed = CreateIdeaRequestSchema.safeParse({
      ...this.coreForm.getRawValue(),
      ...this.contextForm.getRawValue(),
      ...this.tagsForm.getRawValue(),
    });
    if (!parsed.success) {
      this.errorKey.set('ideaCreator.errors.validation');
      return;
    }
    this.saving.set(true);
    this.errorKey.set(null);
    this.api
      .createIdea(parsed.data)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.tokens.rememberIdea({
            id: created.idea.id,
            title: created.idea.title,
            token: created.editToken,
          });
          if (!publish) {
            void this.router.navigate(['/pomysly', created.idea.id]);
            return;
          }
          this.api
            .publishIdea(created.idea.id, created.editToken)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => {
                void this.router.navigate(['/pomysly', created.idea.id]);
              },
              error: (error: unknown) => {
                this.errorKey.set(toErrorKey(error));
                this.saving.set(false);
              },
            });
        },
        error: (error: unknown) => {
          this.errorKey.set(toErrorKey(error));
          this.saving.set(false);
        },
      });
  }
}
