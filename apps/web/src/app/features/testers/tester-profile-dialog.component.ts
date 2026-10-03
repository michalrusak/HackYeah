import { Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import {
  TesterProfileInputSchema,
  type TesterProfile,
} from '@repo/api-contracts';
import { testerErrorKey } from './testers-error';
import { TestersService } from './testers.service';

@Component({
  selector: 'app-tester-profile-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    TranslatePipe,
  ],
  templateUrl: './tester-profile-dialog.component.html',
  styleUrl: './tester-profile-dialog.component.scss',
})
export class TesterProfileDialogComponent {
  readonly profile = inject<TesterProfile | null>(MAT_DIALOG_DATA);
  private readonly service = inject(TestersService);
  private readonly dialog = inject(
    MatDialogRef<TesterProfileDialogComponent, 'saved'>,
  );
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly saving = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly form = this.fb.group({
    displayName: [
      this.profile?.displayName ?? '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(80)],
    ],
    city: [
      this.profile?.city ?? '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
    ],
    bio: [
      this.profile?.bio ?? '',
      [
        Validators.required,
        Validators.minLength(20),
        Validators.maxLength(1200),
      ],
    ],
    skills: [this.profile?.skills.join(', ') ?? ''],
    resources: [this.profile?.resources.join(', ') ?? ''],
    interests: [this.profile?.interests.join(', ') ?? ''],
    accessibilityNeeds: [
      this.profile?.accessibilityNeeds ?? '',
      [Validators.maxLength(600)],
    ],
    availability: this.fb.control<TesterProfile['availability']>(
      this.profile?.availability ?? 'hybrid',
    ),
  });

  save(): void {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    this.errorKey.set(null);
    if (this.form.invalid) {
      this.showValidation();
      return;
    }
    const value = this.form.getRawValue();
    const parsed = TesterProfileInputSchema.safeParse({
      ...value,
      skills: this.split(value.skills),
      resources: this.split(value.resources),
      interests: this.split(value.interests),
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string')
          this.form.get(field)?.setErrors({ invalid: true });
      }
      this.showValidation();
      return;
    }
    this.saving.set(true);
    this.dialog.disableClose = true;
    this.service
      .saveProfile(parsed.data)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.dialog.close('saved'),
        error: (error: unknown) => {
          this.errorKey.set(testerErrorKey(error));
          this.saving.set(false);
          this.dialog.disableClose = false;
        },
      });
  }

  private showValidation(): void {
    this.errorKey.set('testers.profile.validation');
    const field = Object.entries(this.form.controls).find(([, control]) => control.invalid)?.[0];
    if (field) this.element.nativeElement.querySelector<HTMLElement>(`[formControlName="${field}"]`)?.focus();
  }

  private split(value: string): string[] {
    return [
      ...new Set(
        value
          .split(/[,\n]/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];
  }
}
