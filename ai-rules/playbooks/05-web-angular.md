# 05 — Web Angular

> Attach when working on: `apps/web/**`.

## Stack

| Tool | Purpose |
|------|---------|
| Angular 19 | Framework (standalone components) |
| Angular Material + CDK | UI |
| HttpClient | HTTP (via typed API service) |
| Reactive Forms | Forms |
| Zod (from `@repo/api-contracts`) | Validation — parse in service layer |
| `@ngx-translate/core` + http-loader | Translations (`public/i18n/pl.json`) |
| Signals | Reactive state |

## Folder structure

```
apps/web/src/app/
├── core/
│   ├── constants/                   # nav items (labelKey → i18n)
│   ├── layout/                      # app-header, app-layout
│   ├── services/                    # api.service, auth.service
│   ├── interceptors/
│   ├── guards/
│   └── models/
├── pages/                           # proste strony (home, about…)
├── features/                        # większe moduły domenowe
│   └── users/
│       ├── users.routes.ts
│       ├── users.service.ts
│       └── user-list/ …
├── app.config.ts                    # provideTranslateHttpLoader, HttpClient
├── app.routes.ts
public/i18n/
└── pl.json                          # ALL user-facing strings
```

**All features live in `features/`** — never directly in `app/`.

## API Service — typed HTTP

```typescript
// core/services/api.service.ts
@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  get<T>(path: string, schema: ZodType<T>): Observable<T> {
    return this.http.get<ApiResponse<unknown>>(`${this.baseUrl}${path}`).pipe(
      map((json) => {
        if (!json.success) throw new ApiClientError(json.error);
        return schema.parse(json.data);
      }),
    );
  }

  post<T>(path: string, body: unknown, schema: ZodType<T>): Observable<T> {
    return this.http.post<ApiResponse<unknown>>(`${this.baseUrl}${path}`, body).pipe(
      map((json) => {
        if (!json.success) throw new ApiClientError(json.error);
        return schema.parse(json.data);
      }),
    );
  }
}
```

### Feature service

```typescript
// features/users/users.service.ts
@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(private api: ApiService) {}

  getUser(id: string) {
    return this.api.get(`/users/${id}`, UserResponseSchema);
  }

  createUser(input: CreateUserInput) {
    const validated = CreateUserSchema.parse(input);
    return this.api.post('/users', validated, UserResponseSchema);
  }
}
```

**Hard rule:** Components never call `HttpClient` directly — always through feature service.

## Error interceptor

```typescript
// core/interceptors/error.interceptor.ts
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.error?.error?.code) {
        const i18nKey = ERROR_I18N_KEYS[err.error.error.code] ?? 'errors.generic';
        snackBar.open(translate.instant(i18nKey), '', { duration: 5000 });
      }
      return throwError(() => err);
    }),
  );
};
```

Mapowanie kodów błędów API → klucze i18n: w `@repo/api-contracts` (docelowo) lub `core/constants/error-i18n.ts`.

## Reactive Forms + Zod

```typescript
// features/users/user-form/user-form.component.ts
@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, TranslatePipe],
  templateUrl: './user-form.component.html',
})
export class UserFormComponent {
  private fb = inject(FormBuilder);
  private usersService = inject(UsersService);
  private snackBar = inject(MatSnackBar);
  private translate = inject(TranslateService);

  isSubmitting = signal(false);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
  });

  onSubmit() {
    if (this.form.invalid) return;

    const parsed = CreateUserSchema.safeParse(this.form.value);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        this.form.get(field)?.setErrors({ zod: issue.message });
      });
      return;
    }

    this.isSubmitting.set(true);
    this.usersService.createUser(parsed.data).subscribe({
      next: () => {
        this.snackBar.open(this.translate.instant('users.form.success'), '', { duration: 3000 });
        this.form.reset();
        this.isSubmitting.set(false);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        // error interceptor handles display
      },
    });
  }
}
```

### Template — i18n only

```html
<!-- user-form.component.html -->
<form [formGroup]="form" (ngSubmit)="onSubmit()">
  <mat-form-field>
    <mat-label>{{ 'users.form.emailLabel' | translate }}</mat-label>
    <input matInput formControlName="email" type="email" />
    <mat-error *ngIf="form.get('email')?.hasError('required')">
      {{ 'validation.required' | translate }}
    </mat-error>
  </mat-form-field>

  <mat-form-field>
    <mat-label>{{ 'users.form.nameLabel' | translate }}</mat-label>
    <input matInput formControlName="name" />
  </mat-form-field>

  <button mat-raised-button color="primary" type="submit" [disabled]="isSubmitting()">
    {{ (isSubmitting() ? 'users.form.submitting' : 'users.form.submit') | translate }}
  </button>
</form>
```

## i18n — pl.json only

Plik: `public/i18n/pl.json`:

```json
{
  "common": { "save": "Zapisz", "cancel": "Anuluj" },
  "errors": { "emailTaken": "Ten adres e-mail jest już zajęty." },
  "users": {
    "form": {
      "emailLabel": "Adres e-mail",
      "nameLabel": "Imię i nazwisko",
      "submit": "Utwórz użytkownika",
      "submitting": "Tworzenie...",
      "success": "Użytkownik utworzony."
    }
  },
  "validation": { "required": "To pole jest wymagane." }
}
```

**Rules:** Wszystkie teksty UI w `pl.json` — zero hardcoded strings w HTML/TS.

## Routing

```typescript
// features/users/users.routes.ts
export const USERS_ROUTES: Routes = [
  { path: '', component: UserListComponent },
  { path: 'new', component: UserFormComponent },
  { path: ':id', component: UserDetailComponent },
];

// app.routes.ts
export const routes: Routes = [
  { path: 'users', loadChildren: () => import('./features/users/users.routes').then(m => m.USERS_ROUTES) },
];
```

- Lazy-load all features
- Standalone components — no NgModules

## State with signals

```typescript
// features/users/user-list/user-list.component.ts
export class UserListComponent implements OnInit {
  private usersService = inject(UsersService);

  users = signal<UserResponse[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    this.usersService.getUsers(1, 20).subscribe({
      next: (result) => { this.users.set(result.data); this.isLoading.set(false); },
      error: () => { this.error.set('errors.generic'); this.isLoading.set(false); },
    });
  }
}
```

For complex async state with caching, consider `@tanstack/angular-query` — otherwise signals + service is enough (KISS).

## Material theming

- Define theme in `styles.scss` using Material 3 theming API
- Use Material components for: buttons, inputs, dialogs, tables, snackbar
- CDK for: overlay, drag-drop, virtual scroll (when needed)

## Adding a new feature — checklist

```
- [ ] i18n keys in public/i18n/pl.json
- [ ] Zod schema in @repo/api-contracts (if new API interaction)
- [ ] Feature service methods (via ApiService)
- [ ] Standalone component(s) in features/<name>/
- [ ] Lazy route in features/<name>/<name>.routes.ts
- [ ] Register route in app.routes.ts
- [ ] TestBed test for form component
```

## Forbidden

- NgModules for new features
- HttpClient in components — use feature service
- Hardcoded strings in templates
- React/Next/shadcn/Tailwind-first patterns
- next-intl, react-i18next, TanStack Query (React)
- jQuery or direct DOM manipulation
- `any` on form values or API responses
