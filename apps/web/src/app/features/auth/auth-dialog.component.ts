import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import {
  AuthLoginInputSchema,
  AuthRegisterInputSchema,
  type DemoAccount,
} from '@repo/api-contracts';
import { AuthService } from '../../core/services/auth.service';
import { DemoService } from '../../core/services/demo.service';
import { authErrorKey } from './auth-error';

export type AuthMode = 'login' | 'register';

@Component({
  selector: 'app-auth-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslatePipe,
  ],
  templateUrl: './auth-dialog.component.html',
  styleUrl: './auth-dialog.component.scss',
})
export class AuthDialogComponent {
  private readonly auth = inject(AuthService);
  private readonly demo = inject(DemoService);
  private readonly dialog = inject(
    MatDialogRef<AuthDialogComponent, 'authenticated'>,
  );
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly mode = signal<AuthMode>(
    inject<AuthMode>(MAT_DIALOG_DATA) ?? 'login',
  );
  readonly saving = signal(false);
  readonly passwordVisible = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly form = this.fb.group({
    login: [
      '',
      [
        Validators.required,
        Validators.pattern(/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,39}$/),
      ],
    ],
    password: ['', [Validators.required, Validators.maxLength(128)]],
  });

  /** Konta demo — puste poza trybem demo i przy rejestracji. */
  readonly demoAccounts = computed(() =>
    this.mode() === 'login' ? (this.demo.data()?.accounts ?? []) : [],
  );

  constructor() {
    effect(() => {
      const accounts = this.demoAccounts();
      const account =
        accounts.find(({ role }) => role === 'tester') ?? accounts[0];
      if (account && this.form.pristine) this.useDemo(account);
    });
  }

  useDemo({ login, password }: DemoAccount): void {
    this.errorKey.set(null);
    this.form.setValue({ login, password });
  }

  switchMode(): void {
    if (this.saving()) return;
    // Login konta demo jest zajęty, więc nie przenosimy go do rejestracji.
    if (
      this.demoAccounts().some(
        ({ login }) => login === this.form.controls.login.value,
      )
    )
      this.form.controls.login.reset();
    this.mode.update((mode) => (mode === 'login' ? 'register' : 'login'));
    this.errorKey.set(null);
    this.form.controls.password.reset();
    this.passwordVisible.set(false);
    this.element.nativeElement
      .querySelector<HTMLInputElement>('input[formControlName="login"]')
      ?.focus();
  }

  submit(): void {
    if (this.saving()) return;
    this.errorKey.set(null);
    this.form.markAllAsTouched();
    const schema =
      this.mode() === 'register'
        ? AuthRegisterInputSchema
        : AuthLoginInputSchema;
    const parsed = schema.safeParse(this.form.getRawValue());
    if (this.form.invalid || !parsed.success) {
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const field = issue.path[0];
          if (typeof field === 'string')
            this.form.get(field)?.setErrors({ invalid: true });
        }
      }
      this.errorKey.set('auth.errors.validation');
      const field = Object.entries(this.form.controls).find(
        ([, control]) => control.invalid,
      )?.[0];
      if (field)
        this.element.nativeElement
          .querySelector<HTMLInputElement>(`input[formControlName="${field}"]`)
          ?.focus();
      return;
    }
    this.saving.set(true);
    this.dialog.disableClose = true;
    const { login, password } = parsed.data;
    const request =
      this.mode() === 'register'
        ? this.auth.register(login, password)
        : this.auth.login(login, password);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.form.controls.password.reset();
        this.dialog.close('authenticated');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.dialog.disableClose = false;
        this.errorKey.set(authErrorKey(error, true));
      },
    });
  }
}
