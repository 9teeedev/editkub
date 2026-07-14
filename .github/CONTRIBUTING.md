# Contributing to Editkub

Thanks for your interest in contributing! 🎬

## Getting Started

1. Fork the repo
2. `git clone <your-fork>`
3. `bun install` (at repo root — this is a monorepo)
4. `bun run dev:web` → `http://localhost:4100`

## Development

- **Monorepo:** `apps/web` (main app), `packages/ui`, `packages/env`
- **Editor core:** `apps/web/src/core/` — singleton `EditorCore` with managers
- **Actions:** `apps/web/src/lib/actions/definitions.ts` — source of truth for user actions
- **Commands:** `apps/web/src/lib/commands/` — undo/redo mutations

### Before submitting a PR

```bash
bun run lint:web     # biome lint
bun run build:web    # verify build passes
```

## High-Impact Areas

- Timeline behavior and interaction quality
- Project management and reliability
- Performance tuning and bug fixing
- UI improvements outside preview internals

## Areas Under Active Refactor

- Preview panel internals (fonts/stickers/effects)
- Export pipeline internals

## Commit Style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add split-screen support
fix: timeline snapping edge case
chore: bump dependencies
```

## License

By contributing, you agree your contributions are licensed under the MIT License.
