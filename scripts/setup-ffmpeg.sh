#!/usr/bin/env bash
# Copies ffmpeg.wasm assets into apps/web/public/ffmpeg/.
# These files are gitignored (~32MB) — run after `bun install`.
#
# The FFmpeg class spawns its worker with type: "module", so the worker
# (worker.js + its const.js/errors.js imports) and the ESM build of the core
# must be served as plain files. Using the UMD core here would silently hang
# (importScripts is unavailable inside module workers).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FFMPEG_PKG="$ROOT/apps/web/node_modules/@ffmpeg"
DEST="$ROOT/apps/web/public/ffmpeg"

if [ ! -f "$FFMPEG_PKG/core/dist/esm/ffmpeg-core.wasm" ]; then
	echo "error: @ffmpeg/core not installed. Run 'bun install' first." >&2
	exit 1
fi

mkdir -p "$DEST"
cp "$FFMPEG_PKG/core/dist/esm/ffmpeg-core.js" "$DEST/"
cp "$FFMPEG_PKG/core/dist/esm/ffmpeg-core.wasm" "$DEST/"
cp "$FFMPEG_PKG/ffmpeg/dist/esm/worker.js" "$DEST/ffmpeg-worker.js"
cp "$FFMPEG_PKG/ffmpeg/dist/esm/const.js" "$DEST/"
cp "$FFMPEG_PKG/ffmpeg/dist/esm/errors.js" "$DEST/"

echo "ffmpeg.wasm assets copied to apps/web/public/ffmpeg/"
