# AGENTS.md

## Overview

Privacy-first video editor, with a focus on simplicity and ease of use.

## Lib vs Utils

- `lib/` - domain logic (specific to this app)
- `utils/` - small helper utils (generic, could be copy-pasted into any other app)

## Core Editor System

The editor uses a **singleton EditorCore** that manages all editor state through specialized managers.

### Architecture

```
EditorCore (singleton)
├── playback: PlaybackManager
├── timeline: TimelineManager
├── scene: SceneManager
├── project: ProjectManager
├── media: MediaManager
└── renderer: RendererManager
```

### When to Use What

#### In React Components

**Always use the `useEditor()` hook:**

```typescript
import { useEditor } from '@/hooks/use-editor';

function MyComponent() {
  const editor = useEditor();
  const tracks = editor.timeline.getTracks();

  // Call methods
  editor.timeline.addTrack({ type: 'media' });

  // Display data (auto re-renders on changes)
  return <div>{tracks.length} tracks</div>;
}
```

The hook:

- Returns the singleton instance
- Subscribes to all manager changes
- Automatically re-renders when state changes

#### Outside React Components

**Use `EditorCore.getInstance()` directly:**

```typescript
// In utilities, event handlers, or non-React code
import { EditorCore } from "@/core";

const editor = EditorCore.getInstance();
await editor.export({ format: "mp4", quality: "high" });
```

## Actions System

Actions are the trigger layer for user-initiated operations. The single source of truth is `@/lib/actions/definitions.ts`.

**To add a new action:**

1. Add it to `ACTIONS` in `@/lib/actions/definitions.ts`:

```typescript
export const ACTIONS = {
  "my-action": {
    description: "What the action does",
    category: "editing",
    defaultShortcuts: ["ctrl+m"],
  },
  // ...
};
```

2. Add handler in `@/hooks/use-editor-actions.ts`:

```typescript
useActionHandler(
  "my-action",
  () => {
    // implementation
  },
  undefined,
);
```

**In components, use `invokeAction()` for user-triggered operations:**

```typescript
import { invokeAction } from '@/lib/actions';

// Good - uses action system
const handleSplit = () => invokeAction("split-selected");

// Avoid - bypasses UX layer (toasts, validation feedback)
const handleSplit = () => editor.timeline.splitElements({ ... });
```

Direct `editor.xxx()` calls are for internal use (commands, tests, complex multi-step operations).

## Commands System

Commands handle undo/redo. They live in `@/lib/commands/` organized by domain (timeline, media, scene).

Each command extends `Command` from `@/lib/commands/base-command` and implements:

- `execute()` - saves current state, then does the mutation
- `undo()` - restores the saved state

Actions and commands work together: actions are "what triggered this", commands are "how to do it (and undo it)".

## Announcements ("What's new")

In-product news shown by the `AnnouncementBell` (editor + mobile header). Static array, newest first, in `@/lib/announcements.ts` — no backend. Seen state is localStorage (`editkub:seen-announcements`).

**When to add an entry: in the same PR as the user-facing feature it announces.** The entry goes live with the deploy, so the news and the feature land together — never a separate "announcement" PR afterwards.

```typescript
// lib/announcements.ts — add at the TOP of ANNOUNCEMENTS
{
  id: "2026-08-31-karaoke-captions", // unique: date + slug
  tag: "new",                        // "new" | "improved" | "fixed"
  date: "2026-08-31",
  title: "Karaoke captions",         // i18n source strings, translated at render time
  description: "Word-synced captions ...",
  cta: { label: "Try it", panel: "captions" }, // panel = assets-panel tab, or href for a link; both optional
}
```

Rules:

- `title`/`description`/cta `label` go through `t()` — add locale keys manually to all 12 locales (never run translation:extract).
- Keep the list under ~10 entries; the popover only shows the newest 5. Prune old entries occasionally.
- Small fixes without user-visible impact don't need an entry — don't spam the bell.
