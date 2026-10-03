import { Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { TesterProjectInputSchema, type TesterProject } from '@repo/api-contracts';
import { AuthService } from '../../../core/services/auth.service';
import { testerErrorKey } from '../testers-error';
import { projectAccount } from './project-dialog-access';
import { TesterProjectsService } from './tester-projects.service';

export interface ProjectFormData { project?: TesterProject; requirements?: string; }

@Component({
  selector: 'app-project-form-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, TranslatePipe],
  templateUrl: './project-form-dialog.component.html', styleUrl: './projects.scss',
})
export class ProjectFormDialogComponent {
  readonly data = inject<ProjectFormData>(MAT_DIALOG_DATA);
  readonly auth = inject(AuthService);
  private readonly dialogs = inject(MatDialog);
  private readonly dialog = inject(MatDialogRef<ProjectFormDialogComponent, TesterProject>);
  private readonly service = inject(TesterProjectsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = this.fb.group({
    organizerName: [this.data.project?.organizerName ?? '', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    title: [this.data.project?.title ?? '', [Validators.required, Validators.minLength(5), Validators.maxLength(160)]],
    description: [this.data.project?.description ?? '', [Validators.required, Validators.minLength(20), Validators.maxLength(4000)]],
    requirements: [this.data.project?.requirements ?? this.data.requirements ?? '', [Validators.required, Validators.minLength(5), Validators.maxLength(2000)]],
    location: [this.data.project?.location ?? '', [Validators.maxLength(160)]],
    mode: this.fb.control<TesterProject['mode']>(this.data.project?.mode ?? 'remote'),
    stage: this.fb.control<TesterProject['stage']>(this.data.project?.stage ?? 'idea'),
    status: this.fb.control<TesterProject['status']>(this.data.project?.status ?? 'open'),
  });

  save(): void {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    const parsed = TesterProjectInputSchema.safeParse(this.form.getRawValue());
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string') this.form.get(field)?.setErrors({ invalid: true });
      }
      this.error.set('projects.validation');
      const field = Object.entries(this.form.controls).find(([, control]) => control.invalid)?.[0];
      if (field) this.element.nativeElement.querySelector<HTMLElement>(`[formControlName="${field}"]`)?.focus();
      return;
    }
    if (!this.auth.user()) {
      projectAccount(this.dialogs, this.auth).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((authenticated) => { if (authenticated) this.save(); });
      return;
    }
    this.saving.set(true);
    this.dialog.disableClose = true;
    this.error.set(null);
    this.service.save(parsed.data, this.data.project?.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ project }) => this.dialog.close(project),
      error: (error: unknown) => { this.error.set(testerErrorKey(error)); this.saving.set(false); this.dialog.disableClose = false; },
    });
  }
}
