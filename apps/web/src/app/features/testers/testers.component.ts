import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  TesterSearchRequestSchema,
  type TesterProfile,
  type TesterSearchData,
  type TesterSearchSummary,
} from '@repo/api-contracts';
import { forkJoin } from 'rxjs';
import { TesterCardComponent } from './tester-card.component';
import { TesterProfileDialogComponent } from './tester-profile-dialog.component';
import { testerErrorKey } from './testers-error';
import { TestersService } from './testers.service';

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
  readonly query = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.minLength(8),
      Validators.maxLength(2000),
    ],
  });
  readonly form = new FormGroup({ query: this.query });
  readonly profiles = signal<TesterProfile[]>([]);
  readonly myProfile = signal<TesterProfile | null>(null);
  readonly total = signal(0);
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

  constructor() {
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
    forkJoin({
      profiles: this.service.profiles(),
      own: this.service.myProfile(),
      history: this.service.searches(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ profiles, own, history }) => {
          this.profiles.set(profiles.profiles);
          this.total.set(profiles.total);
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
    this.dialog
      .open<
        TesterProfileDialogComponent,
        TesterProfile | null,
        'saved' | 'restored'
      >(TesterProfileDialogComponent, {
        data: this.myProfile(),
        width: '720px',
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: '94vh',
        autoFocus: 'dialog',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => {
        if (!status) return;
        this.result.set(null);
        this.load();
        this.snackBar.open(
          this.translate.instant(
            status === 'saved'
              ? 'testers.profile.saved'
              : 'testers.access.restored',
          ),
          '',
          { duration: 5000 },
        );
        if (status === 'restored') this.query.reset();
      });
  }

  showCatalog(): void {
    this.query.reset();
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
