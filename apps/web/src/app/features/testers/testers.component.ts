import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  TesterSearchRequestSchema,
  type TesterProfile,
  type TesterSearchData,
  type TesterSearchSummary,
  type TesterProject,
} from '@repo/api-contracts';
import { forkJoin, of, Subscription, switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import {
  AuthDialogComponent,
  type AuthMode,
} from '../auth/auth-dialog.component';
import { authErrorKey } from '../auth/auth-error';
import { TesterCardComponent } from './tester-card.component';
import { TesterProfileDialogComponent } from './tester-profile-dialog.component';
import { testerErrorKey } from './testers-error';
import { TestersService } from './testers.service';
import { TesterProjectsComponent } from './projects/tester-projects.component';
import {
  ProjectFormDialogComponent,
  type ProjectFormData,
} from './projects/project-form-dialog.component';

@Component({
  selector: 'app-testers',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    TranslatePipe,
    TesterCardComponent,
    MatTabsModule,
    TesterProjectsComponent,
  ],
  templateUrl: './testers.component.html',
  styleUrl: './testers.component.scss',
})
export class TestersComponent {
  private readonly service = inject(TestersService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly auth = inject(AuthService);
  readonly signingOut = signal(false);
  readonly accountError = signal<string | null>(null);
  readonly query = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.minLength(2),
      Validators.maxLength(2000),
    ],
  });
  readonly form = new FormGroup({ query: this.query });
  readonly profiles = signal<TesterProfile[]>([]);
  readonly myProfile = signal<TesterProfile | null>(null);
  readonly total = signal(0);
  readonly catalogOffset = signal(0);
  readonly moreProfiles = signal(false);
  readonly catalogLoading = signal(false);
  readonly catalogError = signal<string | null>(null);
  readonly selectedTab = signal(0);
  readonly history = signal<TesterSearchSummary[]>([]);
  readonly result = signal<TesterSearchData | null>(null);
  readonly initialLoading = signal(true);
  readonly searching = signal(false);
  readonly openingSearch = signal(false);
  readonly busy = computed(() => this.searching() || this.openingSearch());
  readonly assigning = signal<string | null>(null);
  readonly initialError = signal<string | null>(null);
  readonly searchError = signal<string | null>(null);
  readonly assignmentError = signal<string | null>(null);
  readonly examples = [
    { key: 'accessibility', icon: 'accessibility_new' },
    { key: 'computer', icon: 'computer' },
    { key: 'community', icon: 'groups' },
  ];
  private observedAccountId: string | null | undefined;
  private accountRequest: Subscription | null = null;

  constructor() {
    this.service.profileChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((profile) => this.myProfile.set(profile));
    effect(() => {
      const accountId = this.auth.user()?.id ?? null;
      if (this.observedAccountId === accountId) return;
      const previous = this.observedAccountId;
      this.observedAccountId = accountId;
      if (previous === undefined) return;
      untracked(() => {
        if (previous || this.result()?.matches.length) this.result.set(null);
        this.myProfile.set(null);
        this.history.set([]);
        this.refreshAccount(accountId);
      });
    });
    this.destroyRef.onDestroy(() => this.accountRequest?.unsubscribe());
    this.query.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.result.set(null);
        this.searchError.set(null);
        this.assignmentError.set(null);
      });
    this.load();
  }

  load(): void {
    this.initialLoading.set(true);
    this.initialError.set(null);
    this.auth
      .refresh()
      .pipe(
        switchMap(({ user }) =>
          forkJoin({
            profiles: this.service.profiles(),
            own: user ? this.service.myProfile() : of({ profile: null }),
            history: this.service.searches(),
          }),
        ),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ profiles, own, history }) => {
          this.observedAccountId = this.auth.user()?.id ?? null;
          this.profiles.set(profiles.profiles);
          this.total.set(profiles.total);
          this.catalogOffset.set(profiles.profiles.length);
          this.moreProfiles.set(
            profiles.profiles.length > 0 &&
              profiles.profiles.length < profiles.total,
          );
          this.myProfile.set(own.profile);
          this.history.set(history.searches);
          this.initialLoading.set(false);
        },
        error: (error: unknown) => {
          this.initialError.set(testerErrorKey(error));
          this.initialLoading.set(false);
        },
      });
  }

  useExample(key: string): void {
    if (!this.busy())
      this.query.setValue(
        this.translate.instant(`testers.examples.${key}.query`),
      );
  }

  search(): void {
    if (this.busy() || this.assigning()) return;
    const parsed = TesterSearchRequestSchema.safeParse({
      query: this.query.value,
    });
    if (!parsed.success) {
      this.query.setErrors({ invalid: true });
      this.query.markAsTouched();
      this.element.nativeElement
        .querySelector<HTMLTextAreaElement>('textarea[formControlName="query"]')
        ?.focus();
      return;
    }
    this.searching.set(true);
    this.searchError.set(null);
    this.assignmentError.set(null);
    this.result.set(null);
    this.service
      .search(parsed.data.query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.acceptResult(result);
          this.searching.set(false);
        },
        error: (error: unknown) => {
          this.searchError.set(testerErrorKey(error));
          this.searching.set(false);
        },
      });
  }

  openSearch(id: string): void {
    if (this.busy() || this.assigning()) return;
    this.openingSearch.set(true);
    this.searchError.set(null);
    this.assignmentError.set(null);
    this.service
      .getSearch(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.query.setValue(result.query, { emitEvent: false });
          this.acceptResult(result);
          this.openingSearch.set(false);
        },
        error: (error: unknown) => {
          this.searchError.set(testerErrorKey(error));
          this.openingSearch.set(false);
        },
      });
  }

  toggleAssignment(profileId: string): void {
    const result = this.result();
    if (!result || this.assigning() || this.busy()) return;
    this.assigning.set(profileId);
    this.assignmentError.set(null);
    this.service
      .assign(
        result.id,
        profileId,
        result.assignedProfileIds.includes(profileId),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.acceptResult(updated);
          this.assigning.set(null);
        },
        error: (error: unknown) => {
          this.assignmentError.set(testerErrorKey(error));
          this.assigning.set(null);
        },
      });
  }

  editProfile(): void {
    if (this.initialLoading() || this.initialError()) return;
    if (!this.auth.user()) {
      this.openAuth('register', true);
      return;
    }
    this.dialog
      .open<TesterProfileDialogComponent, TesterProfile | null, 'saved'>(
        TesterProfileDialogComponent,
        {
          data: this.myProfile(),
          width: '720px',
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: '94vh',
          autoFocus: 'dialog',
        },
      )
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => {
        if (!status) return;
        this.result.set(null);
        this.load();
        this.snackBar.open(
          this.translate.instant('testers.profile.saved'),
          '',
          { duration: 5000 },
        );
      });
  }

  openAuth(mode: AuthMode = 'login', editAfterLogin = false): void {
    this.dialog
      .open<AuthDialogComponent, AuthMode, 'authenticated'>(
        AuthDialogComponent,
        {
          data: mode,
          width: '480px',
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: '94vh',
          autoFocus: 'input[formControlName="login"]',
          ariaLabelledBy: 'auth-title',
          ariaDescribedBy: 'auth-intro',
        },
      )
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => {
        if (!status) return;
        this.accountError.set(null);
        this.result.set(null);
        this.service
          .myProfile()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: ({ profile }) => {
              this.myProfile.set(profile);
              if (editAfterLogin) this.editProfile();
              this.load();
            },
            error: (error: unknown) =>
              this.accountError.set(testerErrorKey(error)),
          });
      });
  }

  logout(): void {
    if (this.signingOut() || this.busy() || this.assigning()) return;
    this.signingOut.set(true);
    this.accountError.set(null);
    this.auth
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.signingOut.set(false);
          this.myProfile.set(null);
          this.history.set([]);
          this.result.set(null);
          this.query.reset();
          this.load();
        },
        error: (error: unknown) => {
          this.signingOut.set(false);
          this.accountError.set(authErrorKey(error));
        },
      });
  }

  showCatalog(): void {
    this.query.reset();
  }

  private refreshAccount(accountId: string | null): void {
    this.accountRequest?.unsubscribe();
    this.accountRequest = forkJoin({
      own: accountId ? this.service.myProfile() : of({ profile: null }),
      history: this.service.searches(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ own, history }) => {
          if ((this.auth.user()?.id ?? null) === accountId) {
            this.myProfile.set(own.profile);
            this.history.set(history.searches);
          }
        },
        error: (error: unknown) => this.accountError.set(testerErrorKey(error)),
      });
  }

  loadMoreProfiles(): void {
    if (this.catalogLoading()) return;
    this.catalogLoading.set(true);
    this.catalogError.set(null);
    const offset = this.catalogOffset();
    this.service
      .profiles(offset)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.profiles.update((old) => [
            ...old,
            ...data.profiles.filter(
              (profile) => !old.some((entry) => entry.id === profile.id),
            ),
          ]);
          this.catalogOffset.set(offset + data.profiles.length);
          this.moreProfiles.set(
            data.profiles.length > 0 &&
              offset + data.profiles.length < data.total,
          );
          this.total.set(data.total);
          this.catalogLoading.set(false);
        },
        error: (error: unknown) => {
          this.catalogError.set(testerErrorKey(error));
          this.catalogLoading.set(false);
        },
      });
  }

  newProject(): void {
    this.dialog
      .open<ProjectFormDialogComponent, ProjectFormData, TesterProject>(
        ProjectFormDialogComponent,
        {
          data: { requirements: this.query.value },
          width: '720px',
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: '94vh',
          autoFocus: 'dialog',
        },
      )
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((project) => {
        if (project) this.selectedTab.set(2);
      });
  }

  private acceptResult(result: TesterSearchData): void {
    this.result.set(result);
    const summary: TesterSearchSummary = {
      id: result.id,
      query: result.query,
      summary: result.summary,
      matchCount: result.matches.length,
      assignedCount: result.assignedProfileIds.length,
      createdAt: result.createdAt,
    };
    this.history.update((items) =>
      [summary, ...items.filter((item) => item.id !== result.id)].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    );
  }
}
