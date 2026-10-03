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
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import {
  type TesterActivityData,
  type TesterProject,
} from '@repo/api-contracts';
import { AuthService } from '../../../core/services/auth.service';
import { testerErrorKey } from '../testers-error';
import { projectAccount } from './project-dialog-access';
import {
  ProjectFormDialogComponent,
  type ProjectFormData,
} from './project-form-dialog.component';
import { ProjectDetailDialogComponent } from './project-detail-dialog.component';
import { TesterProjectsService } from './tester-projects.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-tester-projects',
  imports: [MatButtonModule, TranslatePipe],
  templateUrl: './tester-projects.component.html',
  styleUrl: './projects.scss',
})
export class TesterProjectsComponent {
  readonly mode = input<'catalog' | 'activity'>('catalog');
  readonly active = input(true);
  readonly auth = inject(AuthService);
  private readonly service = inject(TesterProjectsService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  readonly projects = signal<TesterProject[]>([]);
  readonly activity = signal<TesterActivityData | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly page = signal(1);
  readonly total = signal(0);
  readonly hasMore = signal(false);
  private request: Subscription | null = null;

  constructor() {
    effect(() => {
      this.mode();
      this.auth.user();
      const active = this.active();
      this.activity.set(null);
      this.projects.set([]);
      untracked(() => {
        this.request?.unsubscribe();
        this.loading.set(false);
        if (active) this.load();
      });
    });
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }
  load(append = false): void {
    this.request?.unsubscribe();
    this.error.set(null);
    if (this.mode() === 'activity' && !this.auth.user()) {
      this.activity.set(null);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    if (this.mode() === 'activity') {
      this.request = this.service
        .activity()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (data) => {
            this.activity.set(data);
            this.loading.set(false);
          },
          error: (error: unknown) => this.failed(error),
        });
    } else {
      const page = append ? this.page() + 1 : 1;
      this.request = this.service
        .list(page)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (data) => {
            this.projects.update((old) =>
              append
                ? [
                    ...old,
                    ...data.projects.filter(
                      (project) =>
                        !old.some((entry) => entry.id === project.id),
                    ),
                  ]
                : data.projects,
            );
            this.page.set(page);
            this.total.set(data.total);
            this.hasMore.set(
              data.projects.length > 0 &&
                data.page * data.pageSize < data.total,
            );
            this.loading.set(false);
          },
          error: (error: unknown) => this.failed(error),
        });
    }
  }
  login(): void {
    projectAccount(this.dialog, this.auth)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }
  create(): void {
    this.dialog
      .open<ProjectFormDialogComponent, ProjectFormData, TesterProject>(
        ProjectFormDialogComponent,
        {
          data: {},
          width: '720px',
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: '94vh',
          autoFocus: 'dialog',
        },
      )
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((project) => {
        if (project) {
          this.load();
          this.open(project);
        }
      });
  }
  open(project: TesterProject): void {
    this.dialog
      .open<ProjectDetailDialogComponent, string, boolean>(
        ProjectDetailDialogComponent,
        {
          data: project.id,
          width: '820px',
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: '94vh',
          autoFocus: 'dialog',
        },
      )
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }
  private failed(error: unknown): void {
    this.error.set(testerErrorKey(error));
    this.loading.set(false);
  }
}
