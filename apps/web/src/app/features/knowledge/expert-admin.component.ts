import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  FormGroupDirective,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import {
  ExpertGrantRequestSchema,
  SocialAreaSchema,
  type ExpertAccount,
  type ExpertListData,
  type SocialArea,
} from '@repo/api-contracts';
import type { Observable } from 'rxjs';
import { DemoService } from '../../core/services/demo.service';
import { KnowledgeService } from './knowledge.service';

/** Nadawanie roli eksperta kontom użytkowników — tylko dla ROPS. */
@Component({
  selector: 'app-expert-admin',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    TranslatePipe,
  ],
  templateUrl: './expert-admin.component.html',
  styleUrls: ['./knowledge.component.scss'],
})
export class ExpertAdminComponent {
  private readonly service = inject(KnowledgeService);
  readonly demo = inject(DemoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formDirective = viewChild(FormGroupDirective);

  readonly areas = SocialAreaSchema.options;
  readonly experts = signal<ExpertAccount[] | null>(null);
  readonly busy = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly noticeKey = signal<string | null>(null);
  readonly form = new FormGroup({
    login: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(40)],
    }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(100),
      ],
    }),
    areas: new FormControl<SocialArea[]>([], {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  constructor() {
    effect(() => {
      const grant = this.demo.data()?.expertGrant;
      if (grant && this.form.pristine) this.form.setValue(grant);
    });
    this.run(this.service.experts(), null);
  }

  edit(expert: ExpertAccount): void {
    this.noticeKey.set(null);
    this.form.setValue({
      login: expert.login,
      name: expert.name,
      areas: expert.areas,
    });
  }

  grant(): void {
    const parsed = ExpertGrantRequestSchema.safeParse(this.form.getRawValue());
    if (this.form.invalid || !parsed.success) {
      this.form.markAllAsTouched();
      this.errorKey.set('knowledge.admin.experts.invalid');
      return;
    }
    this.run(
      this.service.grantExpert(parsed.data),
      'knowledge.admin.experts.done.grant',
    );
  }

  revoke(expert: ExpertAccount): void {
    this.run(
      this.service.revokeExpert(expert.id),
      'knowledge.admin.experts.done.revoke',
    );
  }

  private run(source: Observable<ExpertListData>, notice: string | null): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.errorKey.set(null);
    source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ experts }) => {
        this.experts.set(experts);
        this.busy.set(false);
        if (notice) {
          // Czyści też stan wysłania — inaczej puste pola świecą się na czerwono.
          this.formDirective()?.resetForm();
          this.noticeKey.set(notice);
        }
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.errorKey.set(
          error instanceof HttpErrorResponse && error.status === 404
            ? 'knowledge.admin.experts.noAccount'
            : 'knowledge.admin.experts.error',
        );
      },
    });
  }
}
