# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Editkub is a privacy-first, open-source browser-based video editor. It uses a Turborepo monorepo with Bun as the package manager. The main application lives in `apps/web/` (Next.js 16 + React 19 + TypeScript).

## Commands

### Development
```bash
bun install                        # Install dependencies (from repo root)
bun run dev:web                    # Start web app dev server (port 4100, turbopack)
```

### Linting & Formatting (Biome)
```bash
bun run lint:web                   # Lint check
bun run lint:web:fix               # Lint + auto-fix
cd apps/web && bun run format      # Format code
```

Biome config: tabs, 80-char line width, double quotes. Components in `src/components/ui/` are excluded from linting.

### Testing
```bash
bun test                           # Run all tests (Bun test runner)
bun test path/to/file.test.ts      # Run a single test file
```

### i18n
```bash
cd apps/web
bun run translation:extract        # Extract t() keys into locale JSON files
bun run translation:scan           # Scan for missing translations
bun run translation:translate      # Auto-translate to other locales
```

### Database (optional, for auth)
```bash
cd apps/web
bun run db:generate                # Generate Drizzle migrations
bun run db:migrate                 # Apply migrations
bun run db:push:local              # Push schema to local DB
```

### Docker
```bash
docker compose up redis serverless-redis-http -d   # Backing services only
docker compose up --build                          # Full stack
```

## Architecture

### Monorepo Structure
- `apps/web/` — Main Next.js application
- `packages/ui/` — Shared UI components and icons (`@editkub/ui`)
- `packages/env/` — Environment variable validation (`@editkub/env`)

### EditorCore (Singleton)

The editor is orchestrated through `EditorCore` (`apps/web/src/core/index.ts`), a singleton with domain-specific managers:

- `CommandManager` — undo/redo command pattern
- `PlaybackManager` — playback control
- `TimelineManager` — track/element manipulation
- `ScenesManager` — scene management
- `ProjectManager` — project lifecycle
- `MediaManager` — media asset handling
- `RendererManager` — video rendering/export (FFmpeg.wasm)
- `SaveManager` — project persistence (IndexedDB)
- `AudioManager` — audio handling
- `SelectionManager` — multi-element selection

Access in components via `useEditor()` hook.

### State Management

Zustand stores in `apps/web/src/stores/` handle UI and application state:
- `editor-store.ts` — editor UI state
- `timeline-store.ts` — timeline view state
- `ai-*-store.ts` — AI generation features
- `sounds-store.ts`, `stickers-store.ts`, `character-store.ts` — asset panels

### Routing & i18n

Uses `@i18next-toolkit/nextjs-approuter` with URL-segment strategy. All pages live under `app/[locale]/`. 12 locales supported.

**Critical:** Use `Link` and `useRouter` from `@/lib/navigation`, **not** from `next/link` or `next/navigation`. The `next/navigation` exports like `useParams`, `useSearchParams`, `notFound` are fine.

Translation usage:
- React components: `useTranslation()` from `@i18next-toolkit/nextjs-approuter`
- Server components: `getTranslation(locale)` from `@i18next-toolkit/nextjs-approuter/server`
- Outside React (stores, utilities): `i18next.t()` from `@/lib/i18n`
- Keys must be **string literals** (not variables) for extraction to work
- After adding new `t()` calls, run `translation:extract`

### Storage & Migrations

Projects persist in IndexedDB. When modifying persisted types (`TProject`, `TScene`, `TProjectMetadata`, `TProjectSettings`, `TimelineTrack`, `TimelineElement`), you **must** create a storage migration:

1. Bump `CURRENT_PROJECT_VERSION` in `services/storage/migrations/index.ts`
2. Create transformer in `transformers/vN-to-vM.ts` (pure function)
3. Create migration class in `vN-to-vM.ts` extending `StorageMigration`
4. Register in the `migrations` array
5. Add tests with fixture data

### Services Layer

`apps/web/src/services/` contains backend-like logic running in the browser:
- `renderer/` — FFmpeg.wasm video rendering pipeline
- `storage/` — IndexedDB adapter + migration framework
- `transcription/` — HuggingFace Transformers-based transcription
- `timeline-thumbnail/` — thumbnail generation for timeline
- `video-cache/` — video frame caching

### Mobile / Desktop Dual View Layer

The editor has two independent view layers sharing the same EditorCore and stores:

- **Desktop**: `components/editor/` (excluding `mobile/`)
- **Mobile**: `components/editor/mobile/`

Entry point branches in `app/[locale]/editor/[project_id]/page.tsx` via `useIsMobile()`.

**When modifying any editor feature, you must update both desktop and mobile components.** Key mappings:

| Desktop | Mobile |
|---------|--------|
| `editor-layout.tsx` | `mobile/mobile-editor-layout.tsx` |
| `preview/` | `mobile/mobile-preview.tsx` |
| `timeline/` | `mobile/mobile-timeline/` |
| `properties/` | `mobile/mobile-drawer/mobile-properties-drawer.tsx` |
| `tools-panel/` | `mobile/mobile-drawer/mobile-assets-drawer.tsx` |

Shared layer (both platforms consume, changes must not break either):
- `core/`, `stores/`, `services/`, `hooks/actions/`, `types/`, `constants/`, `lib/`

Design spec: `docs/superpowers/specs/2026-03-30-mobile-editor-design.md`

### API Routes

`apps/web/src/app/api/` — no locale prefix. Includes AI proxy, auth, health check, sound search (Freesound), TTS, and media upload (Cloudflare R2).

## Git Policy

- **Never commit automatically.** Do not run `git add`, `git commit`, or `git push` unless the user explicitly asks. Code changes should be left unstaged for the user to review and commit themselves.
- This applies even during multi-step plans (e.g. subagent-driven-development): skip the "commit" step in every task. The user reviews and commits the final diff themselves at the end.

## Code Conventions

- **Biome** enforces linting/formatting — no ESLint/Prettier
- **No `console.*`** in production code
- **No TypeScript enums, `any`, or namespaces** — use union types, `as const`
- **Destructured props** for all functions: `function foo({ bar }: { bar: string })` not `function foo(bar: string)`
- **Accessibility**: buttons need `type` attribute; `onClick` needs keyboard handler pair; SVGs need `<title>`
- **Separation of concerns**: one file, one responsibility; extract at ~500 lines
- **Comments**: explain WHY, not WHAT; no AI-style obvious commentary
- **Scannable code**: extract complex conditions into named variables/helpers
