import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { TranslatePipe } from '@ngx-translate/core';
import {
  type PilotMatch,
  type TesterProjectDetailData,
  type TesterProfile,
} from '@repo/api-contracts';
import { EMPTY, finalize, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { TestersService } from '../../testers/testers.service';
import { TesterProjectsService } from '../../testers/projects/tester-projects.service';
import { projectAccount } from '../../testers/projects/project-dialog-access';
import { TesterProfileDialogComponent } from '../../testers/tester-profile-dialog.component';
import { PilotMatchesService } from './pilot-matches.service';

@Component({
  selector: 'app-pilot-interest',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    TranslatePipe,
  ],
  templateUrl: './pilot-interest.component.html',
  styleUrl: './pilot-interest.component.scss',
})
export class PilotInterestComponent {
  readonly match = input.required<PilotMatch>();
  readonly auth = inject(AuthService);
  private readonly projects = inject(TesterProjectsService);
  private readonly pilots = inject(PilotMatchesService);
  private readonly testers = inject(TestersService);
  private readonly dialogs = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  readonly detail = signal<TesterProjectDetailData | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly sent = signal(false);
  readonly unavailable = signal(false);
  readonly message = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(1000)],
  });

  readonly form = new FormGroup({ message: this.message });

  constructor() {
    effect((onCleanup) => {
      const id = this.match().id;
      untracked(() => {
        this.loading.set(true);
        const request = this.projects
          .detail(id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (detail) => {
              this.detail.set(detail);
              this.loading.set(false);
            },
            error: () => {
              this.error.set('pilots.detailError');
              this.loading.set(false);
            },
          });
        onCleanup(() => request.unsubscribe());
      });
    });
  }

  submit(): void {
    if (this.busy() || this.message.invalid) {
      this.message.markAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    projectAccount(this.dialogs, this.auth)
      .pipe(
        switchMap((authenticated) =>
          authenticated ? this.projects.detail(this.match().id) : EMPTY,
        ),
        switchMap((detail) => {
          this.detail.set(detail);
          if (
            detail.project.isOwner ||
            (detail.myApplication &&
              detail.myApplication.status !== 'withdrawn')
          )
            return EMPTY;
          if (detail.project.status !== 'open') {
            this.unavailable.set(true);
            return EMPTY;
          }
          return this.testers.myProfile();
        }),
        switchMap(({ profile }) =>
          profile
            ? of('saved')
            : this.dialogs
                .open<
                  TesterProfileDialogComponent,
                  TesterProfile | null,
                  'saved'
                >(TesterProfileDialogComponent, {
                  data: null,
                  width: '720px',
                  maxWidth: 'calc(100vw - 24px)',
                  maxHeight: '94vh',
                  autoFocus: 'dialog',
                })
                .afterClosed(),
        ),
        switchMap((saved) =>
          saved
            ? this.pilots.apply(this.match().id, this.message.value)
            : EMPTY,
        ),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (detail) => {
          this.detail.set(detail);
          this.sent.set(true);
        },
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 409)
            this.unavailable.set(true);
          this.error.set('pilots.sendError');
        },
      });
  }
}
