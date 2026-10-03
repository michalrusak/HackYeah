import { Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { TesterFeedbackInputSchema, type TesterApplicationsData, type TesterProjectDetailData, type TesterProject, type TesterProfile } from '@repo/api-contracts';
import { Observable, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { TesterCardComponent } from '../tester-card.component';
import { TesterProfileDialogComponent } from '../tester-profile-dialog.component';
import { TestersService } from '../testers.service';
import { testerErrorKey } from '../testers-error';
import { projectAccount } from './project-dialog-access';
import { ProjectFormDialogComponent, type ProjectFormData } from './project-form-dialog.component';
import { TesterProjectsService } from './tester-projects.service';

@Component({ selector: 'app-project-detail-dialog', imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, TranslatePipe, TesterCardComponent], templateUrl: './project-detail-dialog.component.html', styleUrl: './projects.scss' })
export class ProjectDetailDialogComponent {
  readonly id = inject<string>(MAT_DIALOG_DATA);
  readonly auth = inject(AuthService);
  private readonly service = inject(TesterProjectsService);
  private readonly testers = inject(TestersService);
  private readonly dialogs = inject(MatDialog);
  private readonly dialog = inject(MatDialogRef<ProjectDetailDialogComponent, boolean>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly data = signal<TesterProjectDetailData | null>(null);
  readonly applicants = signal<TesterApplicationsData['applications']>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly announcement = signal<string | null>(null);
  readonly message = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] });
  readonly feedbackForm = this.fb.group({ rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]], review: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(3000)]], improvement: ['', [Validators.maxLength(2000)]] });

  constructor() { this.load(); }
  load(): void {
    this.loading.set(true); this.error.set(null);
    this.service.detail(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.data.set(data); this.loading.set(false);
        if (data.myFeedback) this.feedbackForm.patchValue(data.myFeedback);
        this.message.setValue(data.myApplication?.message ?? '');
        if (data.project.isOwner) this.loadApplicants();
      }, error: (error: unknown) => { this.error.set(testerErrorKey(error)); this.loading.set(false); },
    });
  }
  edit(): void {
    const project = this.data()?.project;
    if (!project) return;
    this.dialogs.open<ProjectFormDialogComponent, ProjectFormData, TesterProject>(ProjectFormDialogComponent, { data: { project }, width: '720px', maxWidth: 'calc(100vw - 24px)', maxHeight: '94vh', autoFocus: 'dialog' }).afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((saved) => { if (saved) this.load(); });
  }
  apply(): void {
    if (this.busy()) return;
    if (this.message.invalid) { this.message.markAsTouched(); this.error.set('projects.messageError'); return; }
    projectAccount(this.dialogs, this.auth).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((authenticated) => {
      if (!authenticated) return;
      this.service.detail(this.id).pipe(switchMap((detail) => {
        this.data.set(detail);
        if (detail.project.isOwner) { this.loadApplicants(); return of(null); }
        return this.testers.myProfile();
      }), takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (own) => {
          if (!own) return;
          const { profile } = own;
          if (profile) this.mutate(this.service.apply(this.id, this.message.value), 'projects.applied');
          else this.dialogs.open<TesterProfileDialogComponent, TesterProfile | null, 'saved'>(TesterProfileDialogComponent, { data: null, width: '720px', maxWidth: 'calc(100vw - 24px)', maxHeight: '94vh', autoFocus: 'dialog' }).afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((saved) => { if (saved) this.mutate(this.service.apply(this.id, this.message.value), 'projects.applied'); });
        }, error: (error: unknown) => this.error.set(testerErrorKey(error)),
      });
    });
  }
  withdraw(): void { this.mutate(this.service.withdraw(this.id), 'projects.withdrawn'); }
  decide(applicationId: string, status: 'accepted' | 'declined'): void { this.mutate(this.service.decide(this.id, applicationId, status), 'projects.decisionSaved'); }
  saveFeedback(): void {
    if (this.busy()) return;
    this.feedbackForm.markAllAsTouched();
    const parsed = TesterFeedbackInputSchema.safeParse(this.feedbackForm.getRawValue());
    if (!parsed.success) {
      for (const issue of parsed.error.issues) { const field = issue.path[0]; if (typeof field === 'string') this.feedbackForm.get(field)?.setErrors({ invalid: true }); }
      this.error.set('projects.feedbackError');
      const field = Object.entries(this.feedbackForm.controls).find(([, control]) => control.invalid)?.[0];
      if (field) this.element.nativeElement.querySelector<HTMLElement>(`[formControlName="${field}"]`)?.focus();
      return;
    }
    this.mutate(this.service.feedback(this.id, parsed.data), 'projects.feedbackSaved');
  }
  private mutate(request: Observable<TesterProjectDetailData>, announcement: string): void {
    if (this.busy()) return;
    this.busy.set(true); this.dialog.disableClose = true; this.error.set(null); this.announcement.set(null);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => { this.data.set(data); this.busy.set(false); this.dialog.disableClose = false; this.announcement.set(announcement); if (data.project.isOwner) this.loadApplicants(); },
      error: (error: unknown) => { this.error.set(testerErrorKey(error)); this.busy.set(false); this.dialog.disableClose = false; },
    });
  }
  private loadApplicants(): void {
    this.service.applications(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: ({ applications }) => this.applicants.set(applications), error: (error: unknown) => this.error.set(testerErrorKey(error)) });
  }
}
