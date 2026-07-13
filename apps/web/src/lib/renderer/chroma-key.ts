/**
 * Per-frame chroma keying on the CPU (Canvas2D ImageData).
 *
 * The renderer is 100% Canvas2D (no WebGL), so chroma keying is a pixel
 * loop that computes the distance from each pixel's RGB to the key color
 * and writes alpha accordingly. The math is intentionally cheap so it can
 * run every frame for video:
 *
 *   d        = |r - kr| + |g - kg| + |b - kb|  (L1 distance, normalized 0-1)
 *   alpha    = smoothstep(threshold, threshold + smoothness, d)
 *   spill    = if pixel's green/blue dominates (chroma > luma), pull it down
 *
 * `applyChromaKey` draws the source into `target`, reads back ImageData,
 * rewrites alpha + spill, and puts it back. The caller reuses `target`
 * across frames to avoid reallocation.
 */
import type { ChromaKeyConfig } from "@/types/timeline";

export type DrawableCanvas = OffscreenCanvas | HTMLCanvasElement;
type Canvas2DContext =
	| CanvasRenderingContext2D
	| OffscreenCanvasRenderingContext2D;

function createCanvas({
	width,
	height,
}: {
	width: number;
	height: number;
}): DrawableCanvas {
	try {
		return new OffscreenCanvas(width, height);
	} catch {
		const fallback = document.createElement("canvas");
		fallback.width = width;
		fallback.height = height;
		return fallback;
	}
}

export function applyChromaKey({
	source,
	sourceWidth,
	sourceHeight,
	config,
	target,
}: {
	source: CanvasImageSource;
	sourceWidth: number;
	sourceHeight: number;
	config: ChromaKeyConfig;
	target: DrawableCanvas;
}): DrawableCanvas {
	const ctx = target.getContext("2d") as Canvas2DContext | null;
	if (!ctx) return target;

	// Draw the source frame, then read pixels for the key pass.
	ctx.globalCompositeOperation = "source-over";
	ctx.clearRect(0, 0, sourceWidth, sourceHeight);
	ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight);

	const imageData = ctx.getImageData(0, 0, sourceWidth, sourceHeight);
	const data = imageData.data;
	const [kr, kg, kb] = config.keyColor;

	// Normalize distances. L1 over RGB max = 765.
	const maxDist = 255 * 3;
	const threshold = config.threshold;
	// smoothness mapped to a positive edge width in normalized distance.
	const edge = Math.max(0.001, config.smoothness * 0.3);
	const lower = threshold;
	const upper = threshold + edge;
	const invEdge = 1 / (upper - lower);

	const spill = config.spillSuppression;

	for (let i = 0; i < data.length; i += 4) {
		const r = data[i];
		const g = data[i + 1];
		const b = data[i + 2];

		// L1 distance to key color, normalized to [0,1].
		const dist =
			(Math.abs(r - kr) + Math.abs(g - kg) + Math.abs(b - kb)) / maxDist;

		// smoothstep(lower, upper, dist) → alpha factor in [0,1].
		let factor: number;
		if (dist <= lower) {
			factor = 0;
		} else if (dist >= upper) {
			factor = 1;
		} else {
			const t = (dist - lower) * invEdge;
			factor = t * t * (3 - 2 * t);
		}

		// Write alpha (scale existing alpha by the factor).
		data[i + 3] = (data[i + 3] * factor) | 0;

		// Spill suppression: where green/blue dominates luma, desaturate.
		if (spill > 0 && factor > 0) {
			const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) | 0;
			// Chroma excess = how much g (or b for blue screens) exceeds luma.
			const dominant = Math.max(g, b);
			const excess = Math.max(0, dominant - luma);
			if (excess > 0) {
				const pull = excess * spill;
				// Pull the dominant channel toward luma.
				if (g > luma) data[i + 1] = Math.max(0, g - pull) | 0;
				if (b > luma) data[i + 2] = Math.max(0, b - pull) | 0;
			}
		}
	}

	ctx.putImageData(imageData, 0, 0);
	return target;
}

/** Ensure a reusable chroma-target canvas of the given dimensions. */
export function ensureChromaTarget({
	existing,
	width,
	height,
}: {
	existing: DrawableCanvas | undefined;
	width: number;
	height: number;
}): DrawableCanvas {
	const needsRecreate =
		!existing || existing.width !== width || existing.height !== height;
	if (!needsRecreate && existing) return existing;
	return createCanvas({ width, height });
}

/** Parse a hex color string (no #) to [r, g, b]. */
export function hexToRgb(hex: string): [number, number, number] {
	const clean = hex.replace("#", "");
	const full =
		clean.length === 3
			? clean
					.split("")
					.map((c) => c + c)
					.join("")
			: clean;
	const num = Number.parseInt(full, 16);
	return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** Convert [r, g, b] to a hex string (no #). */
export function rgbToHex(rgb: [number, number, number]): string {
	return rgb
		.map((c) => c.toString(16).padStart(2, "0"))
		.join("")
		.toUpperCase();
}

/** Preset key colors. */
export const CHROMA_PRESETS: { id: string; label: string; hex: string }[] = [
	{ id: "green", label: "Green", hex: "00FF00" },
	{ id: "blue", label: "Blue", hex: "0000FF" },
	{ id: "red", label: "Red", hex: "FF0000" },
];

export const CHROMA_DEFAULT: ChromaKeyConfig = {
	keyColor: [0, 255, 0],
	threshold: 0.15,
	smoothness: 0.3,
	spillSuppression: 0.5,
};
