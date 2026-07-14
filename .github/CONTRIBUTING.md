# Contributing to Editkub

> ⚠️ **We are currently NOT accepting feature PRs while we build out the core editor.**

If you want to contribute:

1. Open an issue first to discuss
2. Wait for maintainer approval
3. Only then start coding

Critical bug fixes may be accepted on a case-by-case basis.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Bun](https://bun.sh/docs/installation)
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose (optional, for Redis/PostgreSQL)

### Setup

1. Fork the repository
2. Clone your fork locally
3. Install dependencies: `bun install` (at repo root — this is a monorepo)
4. Start the development server: `bun run dev:web`
5. Open `http://localhost:4100`

> **Note:** Core editor works without any env vars. Only auth/Redis features need backing services.

## What to Focus On

**Good areas to contribute:**

- Timeline functionality and UI improvements
- Project management features
- Performance optimizations
- Bug fixes in existing functionality
- UI/UX improvements
- Documentation and testing

**Areas to avoid:**

- Preview panel enhancements (text fonts, stickers, effects)
- Export functionality improvements
- Preview rendering optimizations

## Code Style

- We use [Biome](https://biomejs.dev/) for code formatting and linting
- Run `bun run lint:web` from repo root to check linting
- Follow existing code patterns

## Pull Request Process

1. Fill out the pull request template completely
2. Link any related issues
3. Ensure build passes: `bun run build:web`
4. Request review from maintainers
5. Address any feedback

## Community

- Be respectful and inclusive
- Follow our [Code of Conduct](CODE_OF_CONDUCT.md)
- Help others in discussions and issues

Thank you for contributing!
