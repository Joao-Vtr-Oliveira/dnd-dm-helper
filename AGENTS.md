# AGENTS.md

## Commands
- `npm run dev` and `npm start` both run `ng serve`.
- `npm run build` runs the production Angular build. There is no separate `lint` or `typecheck` script; this is the closest full compile check.
- `npm test` runs Karma/Jasmine in watch mode.
- Focused test run: `npm test -- --watch=false --browsers=ChromeHeadless --include=src/app/path/to/file.spec.ts`

## App Shape
- This repo is a single Angular 20 app, not a monorepo. Bootstrap starts at `src/main.ts`; app-wide providers live in `src/app/app.config.ts`; routes live in `src/app/app.routes.ts`.
- `src/app/pages/home/home.ts` is the shell component. Most real screens are child routes under `/home/*`; `/` redirects to `/home/encounter-builder`.
- `src/app/pages/*` holds standalone page components. Most state and business logic lives in `src/app/services/*`.
- Campaign data is local-first. `src/app/constants/app-storage-keys.ts` is the source of truth for project `localStorage` and `sessionStorage` keys.
- Global backup/sync flow is centered in `src/app/services/app-backup-service/app-backup-service.ts`.
- 5etools work is centered in `src/app/pages/fiveetools-homebrew/`, `src/app/services/fiveetools-homebrew-service/`, and `src/app/services/fiveetools-reference-data-service/`.
- Path quirk: `src/app/services/WorldClockService/` uses a capitalized directory name.

## Testing Gotchas
- The app is zoneless: `src/app/app.config.ts` uses `provideZonelessChangeDetection()`.
- Specs that only use bare `TestBed.configureTestingModule({})` currently fail under headless Karma with `NG0908: In this configuration Angular requires Zone.js`.
- When adding or fixing specs, provide zoneless test setup explicitly and add route/http providers only where needed (`provideZonelessChangeDetection()`, `provideRouter([])`, `provideHttpClient()`).
- Storage-heavy specs usually clear `localStorage` in `beforeEach()`. Backup-related specs also clear `sessionStorage`.

## Environment And Seed Data
- `src/environments/environment.ts` and `src/environments/environment.prod.ts` define the default remote sync URLs.
- Those URLs point to raw GitHub copies of files committed under `rpg_files/`. If you change the default backup or default 5etools JSON, update both the file in `rpg_files/` and the environment URL target.
- `showDmCalendar` differs by env: `true` in dev, `false` in prod.

## Formatting
- `.editorconfig` enforces tabs, width 2, and no final newline.
- Prettier config is inline in `package.json`: single quotes, print width 100, and the `angular` parser for `*.html`.
- Tailwind CSS v4 is loaded through `@import 'tailwindcss'` in `src/styles.css`; the global theme tokens also live there.

## Current Verification Baseline
- `npm run build` currently succeeds but emits an initial bundle budget warning (`500 kB` budget vs about `908 kB`) and two selector warnings. Treat that as the current baseline unless your change makes it worse.
