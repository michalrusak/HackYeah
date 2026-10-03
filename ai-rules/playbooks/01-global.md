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
