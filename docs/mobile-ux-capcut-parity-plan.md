# Mobile UX Overhaul — CapCut Parity Plan

> Created 2026-08-26. Analysis of CapCut Mobile reference screenshots
> (`~/Downloads/CapCutMobileUXUI`, 8 images) vs. current `editkub-public`
> mobile editor. All items below were implemented in one overnight batch;
> each item landed as its own commit.

## Why

The mobile layout (`apps/web/src/components/editor/mobile/`) has the right
skeleton (centered playhead, drawers, trim handles) but is hard to use:

- Export does nothing (`handleExport` was an empty TODO in the overflow menu).
- Editing a clip takes 3–4 taps (select → tap again → drawer → find tool);
  CapCut shows clip tools in the bottom bar after one tap.
- Elements on the preview canvas cannot be touched at all on mobile.
- Tracks are colored blocks with labels — no filmstrip, no waveform, no ruler.
- Captions / Effects / Filters / Transitions views are unreachable on mobile.
- The TikTok safe-zone overlay existed as dead code (store + blueprint PNG,
  no mount, no toggle).
- No SRT import/export anywhere (already on the public roadmap).

## Work items

### 1. Mobile Export (P0)

- New `mobile-export-drawer.tsx` porting the desktop export popover
  (format, quality, include-audio, progress, cancel, error + retry +
  WebM fallback). Calls the existing `editor.project.export()`.
- New shared util `lib/download.ts`: `downloadBlob()` and
  `shareOrDownloadFile()` (Web Share API first, anchor-click fallback) —
  reused later by SRT export.
- Prominent Export button in the mobile header (replaces the dead
  overflow-menu item).

### 2. Contextual Clip Toolbar (P0)

- `mobile-toolbar.tsx` subscribes to selection: when a clip is selected the
  bottom bar swaps to clip tools (back, split, delete, volume, edit).
  Follows the CapCut pattern: tap clip → tools appear immediately.

### 3. Preview Direct Manipulation (P1)

- Wrap the mobile preview canvas in a sized `div.relative` and mount the
  desktop `PreviewInteractionOverlay` (selection box, handles, guides).
- Play button only shows when paused and nothing is selected.
- Touch hardening shared with desktop: `touch-action: none` on the overlay
  and handles, ≥28px hit areas on corner/side handles.
- Multi-pointer support in `use-preview-interaction.ts`: two-finger pinch
  scales (0.1–5 clamp) and rotates the selected element; commits as one
  undo step via the existing snapshot pattern.

### 4. Timeline Visuals (P1)

- Video tracks render `VideoThumbnailStrip` filmstrips, audio tracks render
  `AudioWaveform`, images render as cover thumbnails.
- Zoom in `use-timeline-scroll.ts` becomes reactive state (was a ref — pinch
  never re-rendered track widths).
- Mobile ruler assembled from `getRulerConfig` + `TimelineTick`; timecode
  row reuses `EditableTimecode`.

### 5. Quick-add "+" buttons (P2)

- A `+` button at the end of each track opens the matching drawer
  (media / sounds / text).

### 6. Toolbar Tabs Expansion (P2)

- New tabs: Captions, Effects, Filters, Transitions — thin drawer wrappers
  around the existing zero-prop desktop views. Toolbar scrolls horizontally.
- i18n keys added manually to all 12 locales (never run extract).

### 7. TikTok Safe Zone Toggle

- Mount the existing `LayoutGuideOverlay` (9:16 blueprint PNG) inside both
  preview layouts' sized wrapper, below selection overlays, pointer-events
  none, `object-contain` so non-9:16 canvases letterbox.
- Toggle button: desktop preview toolbar + floating button on mobile
  preview. Uses the existing persisted `toggleLayoutGuide("tiktok")`.
  `TPlatformLayout` stays open for future Shorts/Reels.

### 8. SRT Import/Export

- New `lib/transcript/srt.ts`: `parseSrt` → `TranscriptionSegment[]`,
  `serializeSrt`, `HH:MM:SS,mmm` formatting (structured for a future VTT).
- Export: `getTranscriptCaptionGroups()` → cues at the current
  words-per-group granularity → `shareOrDownloadFile()`.
- Import: file picker (`.srt`) → parse → existing pipeline
  (`extractWordsFromSegments` → `buildSentenceSegments` → `rebuildCaptionTrack`)
  with `wordTiming: "estimated"`; single undo entry; replaces transcript.
- UI: import/export icon buttons in the Captions view header — works on
  desktop and mobile (mobile reaches it via the new Captions drawer).
- Unit tests for the parse/serialize round trip next to `group-words.test.ts`.

## Verification

- `cd apps/web && bunx tsc --noEmit` after every item.
- `bun run build:web` at the end (Next.js catches what tsc misses).
- Biome is not a gate on this branch; user tests on a real device.

## Out of scope (deliberately)

Mute/cover quick actions, AI sparkle FAB, auto-lyrics, stub add-tracks,
cover picker, VTT, other platform guides, drawn red-zone overlays.
