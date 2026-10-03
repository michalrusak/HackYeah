# Bundle: frontend-angular.md

> Auto-generated from `playbooks/`. Edit playbooks, then rebuild.
> Run: `node ai-rules/scripts/build-bundles.mjs`

---
# 00 — Web scaffold (Angular)

> Attach when bootstrapping or extending **`apps/web`**. Backend: `00-scaffold.md`.

## App: `apps/web`

```
apps/web/
├── angular.json
├── package.json
├── public/
│   └── i18n/
│       └── pl.json                 # ALL UI strings (ngx-translate)
├── scripts/                        # (opcjonalnie — prefer root scripts/)
└── src/
    ├── app/
    │   ├── core/
    │   │   ├── constants/
    │   │   ├── layout/             # app-header, app-layout
    │   │   ├── models/
    │   │   ├── services/           # api.service, auth.service
    │   │   └── interceptors/
    │   ├── pages/                  # route-level pages (home, about…)
    │   ├── features/               # docelowo: większe moduły domenowe
    │   ├── app.config.ts
    │   ├── app.routes.ts
    │   └── app.component.ts
    ├── index.html                  # lang="pl"
    └── styles.scss
```

## Required deps (frontend)

- `@angular/*` 19.x
- `@angular/material`, `@angular/cdk`, `@angular/animations`
- `@ngx-translate/core`, `@ngx-translate/http-loader`

Port: **`WEB_PORT`** z `.env`, domyślnie **4200**.  
API URL: **`API_URL`** z `.env`, domyślnie `http://localhost:3000`.

Dev/start uruchamiane przez root `scripts/web-dev.mjs` / `scripts/web-serve.mjs` (cross-platform).

## i18n

- Plik: `public/i18n/pl.json`
- Konfiguracja: `app.config.ts` → `provideTranslateHttpLoader({ prefix: './i18n/', suffix: '.json' })`
- Szablony: `{{ 'nav.home' | translate }}`
- Nawigacja: klucze w `core/constants/app.constants.ts` (`labelKey`, nie hardcoded label)

**Hard rule:** zero hardcoded user-facing strings w HTML/TS.

## Po dodaniu resource w API — kroki frontend

```
1. Klucze i18n w public/i18n/pl.json
2. (docelowo) typy/schemas w @repo/api-contracts
3. Metody w features/<name>/<name>.service.ts (HttpClient tylko tu lub w ApiService)
4. Standalone component(s) w features/<name>/
5. Trasa lazy w <name>.routes.ts + wpis w app.routes.ts
```

Szczegóły: `playbooks/05-web-angular.md`.


---

# 01 — Global rules

> **Always attach** this playbook in every AI session.

## AI workflow

1. **Plan first.** For anything beyond a one-line fix, output:
   - Goal (1 sentence)
   - Steps (numbered)
   - Files to create/edit
   - Risks or open questions
   Then wait for confirmation on large changes (>3 files or new module).
2. **Read before write.** Open existing files in the target app. Match naming, imports, and patterns already there.
3. **Minimal diff.** Only change what the task requires. No drive-by refactors, no unused code, no "while I'm here" dependency bumps.
4. **No AI slop.** No filler comments, no over-abstracted helpers, no 200-line files when 40 lines suffice. Code should look like a senior dev wrote it under time pressure — clean, direct, boring.
5. **Verify.** Before claiming done, run lint:fix/test for affected packages and report results.

## Git — agent restrictions

**NEVER** unless user explicitly asks:

```
git commit | git push | git merge | git rebase | gh pr create
```

**Allowed** for analysis: `git status`, `git diff`, `git log`, `git branch`

### Human workflow

| Item | Rule |
|------|------|
| Branch | `feat/`, `fix/`, `chore/` + kebab-case |
| PR size | ≤300 lines when possible |
| PR body | What / Why / How to test |
| Commits | Conventional Commits: `feat(users): add create endpoint` |
| Main | Protected — merge only via PR |

## TypeScript

```jsonc
// packages/tsconfig/base.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

| Rule | Detail |
|------|--------|
| No `any` | Use concrete type, generic, or discriminated union |
| No `unknown` as escape | Validate with Zod at boundaries, then use inferred type |
| Return types | Required on exported functions, services, hooks, API handlers |
| Shared types | Live in `@repo/api-contracts` — never duplicate in apps |
| Path aliases | `@repo/api-contracts`, `@repo/<package>` |

```typescript
// ❌ BAD
const body = req.body as CreateUserInput;
const data: any = await fetch(...);

// ✅ GOOD
const body = CreateUserSchema.parse(req.body);
const data = UserResponseSchema.parse(json.data);
```

### Forbidden

- `@ts-ignore`, `@ts-expect-error`
- `eslint-disable` (any form)
- Non-null assertion `!` without prior guard
- Type assertion `as T` without prior Zod parse

## ESLint + Prettier

- Shared config: `packages/eslint-config`
- Prettier: root `.prettierrc`
- All apps extend shared config — no local rule weakening
- Fix errors; never suppress

```bash
pnpm turbo lint:fix --filter=<app>
pnpm turbo format:check   # if configured
```

## SOLID — how we apply it

### S — Single Responsibility

One class/file = one reason to change.

| Layer | Responsibility | Must NOT do |
|-------|---------------|-------------|
| Controller / route.ts | HTTP: parse request, call service, return response | Business rules, Prisma |
| Service | Business logic, orchestration, mapping to response DTO | HTTP details, raw SQL |
| Repository | Database queries (Prisma) | Business rules, HTTP |

```typescript
// ❌ BAD — service does HTTP + DB + validation
@Post()
async create(@Body() body) {
  if (!body.email.includes('@')) return { error: 'bad email' };
  return this.prisma.user.create({ data: body });
}

// ✅ GOOD
@Post()
create(@Body(new ZodValidationPipe(CreateUserSchema)) body: CreateUserInput) {
  return this.usersService.create(body);
}
```

### O — Open/Closed

Extend via new modules/classes, not by editing existing ones with growing if/else.

```typescript
// ❌ BAD
if (user.plan === 'premium') { /* 20 lines */ }
else if (user.plan === 'free') { /* 20 lines */ }

// ✅ GOOD — new behavior = new class/module
interface NotificationSender { send(user: User, msg: string): Promise<void>; }
class EmailSender implements NotificationSender { ... }
class PushSender implements NotificationSender { ... }
```

### L — Liskov Substitution

Repository interfaces must be swappable (real Prisma repo vs in-memory mock in tests).

```typescript
// users.repository.interface.ts
export abstract class UsersRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract create(data: CreateUserInput): Promise<User>;
}

// tests: class InMemoryUsersRepository implements UsersRepository { ... }
```

### I — Interface Segregation

Small, focused interfaces. Don't force a class to implement methods it doesn't need.

```typescript
// ❌ BAD — fat interface
interface UserRepo {
  findById; create; delete; sendEmail; generateReport;
}

// ✅ GOOD — split
interface UsersReader { findById(id: string): Promise<User | null>; }
interface UsersWriter { create(data: CreateUserInput): Promise<User>; }
```

### D — Dependency Inversion

High-level modules depend on abstractions, not Prisma directly.

```typescript
// ✅ Service depends on repository, not PrismaService
@Injectable()
export class UsersService {
  constructor(private readonly usersRepo: UsersRepository) {}
}
```

## DRY — single source of truth

| What | Single location |
|------|----------------|
| Request/response schemas | `@repo/api-contracts` (Zod) |
| Error codes | `@repo/api-contracts/src/error-codes.ts` |
| API response types | `@repo/api-contracts/src/response.types.ts` |
| ESLint/TS config | `packages/eslint-config`, `packages/tsconfig` |

Frontend DRY (services, i18n): `05-web-angular.md`.

If you copy a Zod schema, type, or error code into an app — you're doing it wrong.

## KISS — when to stop abstracting

| Situation | Do | Don't |
|-----------|-----|-------|
| 1 endpoint, 1 query | One service method + one repo method | Generic `BaseCrudService<T>` |
| 2 similar forms | Copy and adjust | Abstract mega-form component on day 1 |
| 3 env vars | `process.env.DATABASE_URL` with Zod parse in `env.ts` | Config service with 5 layers |
| Error handling | Global filter + `apiError()` helper | Custom error class hierarchy per feature |

**Rule of thumb:** abstract on the **third** repetition, not the first.

## Secrets and env

- `.env.example` committed — documents every var
- `.env` never committed
- No secrets in source, Dockerfiles, or client-side env vars
- Client env: tylko publiczne zmienne (np. `API_URL` w root `.env`, ładowane przez Turbo / skrypty Node) — bez sekretów w Angularze


---

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
