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
