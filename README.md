<p align="center">
  <img src="apps/web/public/logos/editkub/Editkub_Banner.png" alt="Editkub banner" />
</p>

<h1 align="center">Editkub</h1>

<p align="center">
  Privacy-first, open-source video editing.<br />
  Build, trim, layer, and export directly from your browser.
</p>

<p align="center">
  <a href="LICENSE">![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)</a>
  <a href=".github/CONTRIBUTING.md">![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)</a>
  <a href="https://buymeacoffee.com/9teeedev"><img src="https://img.shields.io/badge/Donate-Buy%20Me%20a%20Coffee-orange" /></a>
</p>

<p align="center">
  <a href="https://www.buymeacoffee.com/9teeedev"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" width="150" alt="Buy Me A Coffee" /></a>
</p>

---

> **Fork notice:** Editkub is a fork of [msgbyte/cutia](https://github.com/msgbyte/cutia), which itself forks [OpenCut-app/OpenCut](https://github.com/OpenCut-app/OpenCut). Released under the same MIT license with original copyright retained.

## At a Glance

Editkub is designed for creators who want a clean editing workflow without subscriptions, tracking, or watermark traps.

- Local-first editing mindset
- Timeline-based multi-track workflow
- Real-time preview while editing
- Open-source and contribution-friendly

## Why Editkub Exists

Most lightweight editors are either too limited or progressively locked behind paywalls.  
Editkub focuses on a simple idea: powerful basics should stay accessible.

## What You Can Do

- Arrange clips in a timeline
- Layer video, text, audio, and stickers
- Preview changes in real time
- Export without watermark pressure

## Stack Snapshot

- `Next.js 16` application in `apps/web`
- `Bun` for dependency management and scripts
- `Turborepo` monorepo (`apps/web`, `packages/ui`, `packages/env`)
- `PostgreSQL + Redis` (optional for frontend-only work)
- `TypeScript` across the project

## Quick Start (Frontend Only)

> **Core editor works 100% client-side.** No env vars, no databases needed to start editing.

```bash
git clone https://github.com/9teeedev/editkub.git
cd editkub
bun install
bun run dev:web
```

Open `http://localhost:4100`.

## Full Local Setup (With Backend Services)

Some optional features (auth, freesound, uploads) need backing services.

### 1. Start Redis

```bash
docker compose up redis serverless-redis-http -d
```

### 2. Configure env

```bash
cp apps/web/.env.example apps/web/.env.local
```

Required for Redis-backed features:

```bash
UPSTASH_REDIS_REST_URL="http://localhost:8079"
UPSTASH_REDIS_REST_TOKEN="editkub_redis_token"
```

### 3. (Optional) Enable Authentication

Start PostgreSQL:

```bash
docker compose up redis serverless-redis-http postgres -d
```

Add to `.env.local`:

```bash
DATABASE_URL="postgresql://editkub:***@localhost:5432/editkub"
BETTER_AUTH_SECRET="your-generated-secret-here"
```

Generate `BETTER_AUTH_SECRET`:

```bash
openssl rand -base64 32
```

Run migrations then start dev:

```bash
cd apps/web
bun run db:migrate
cd ..
bun run dev:web
```

## Docker Deployment

Run the full application with Docker:

```bash
docker compose up --build
```

Open `http://localhost:3000`.

This starts Redis and the web app. To enable authentication, uncomment the PostgreSQL service and related env vars in `docker-compose.yaml`.

> **AI features** (image generation, TTS, auto-captions via remote API) are disabled by default. Set `EDITKUB_AI_ENABLED=1` to enable.

## Deploy on Vercel

The editor works on Vercel free tier with zero configuration — no env vars required.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2F9teeedev%2Feditkub&project-name=editkub&repository-name=editkub)

## Contributing

Contributions are welcome. Check `.github/CONTRIBUTING.md` before opening a PR.

Current high-impact areas:

- Timeline behavior and interaction quality
- Project management and reliability
- Performance tuning and bug fixing
- UI improvements outside preview internals

## License

Released under the [MIT License](LICENSE).

<p align="right">
  <sub><sup>NOTE: fork from opencut (#fca99d6126c31fbb18ed9f1034cee6f940b040e8)</sup></sub>
</p>
