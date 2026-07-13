/**
 * Video effects library (VFX) — per-frame pixel effects that CSS filters
 * cannot express.
 *
 * The renderer is 100% Canvas2D, so these are CPU ImageData passes that
 * hook into the same mask path as chroma key (visual-node getMaskedSource).
 * Each effect is a pure transform on a Uint8ClampedArray RGBA buffer.
 *
 * Effects:
 *   - glitch:    RGB channel split + horizontal slice displacement
 *   - vhs:       scanline darkening + slight chroma shift + noise
 *   - pixelate:  blocky downsampling
 *   - rgb-split: fixed RGB channel offset (no temporal jitter, calmer than glitch)
 *   - halftone:  dot-pattern dithering
 */
import {
	createCanvas,
	type DrawableCanvas,
} from "@/lib/renderer/chroma-key";

type Canvas2DContext =
	| CanvasRenderingContext2D
	| OffscreenCanvasRenderingContext2D;

export type VideoEffectId =
	| "none"
	| "glitch"
	| "vhs"
	| "pixelate"
	| "rgb-split"
	| "halftone";

export interface VideoEffectConfig {
	effect: VideoEffectId;
	/** 0-1 strength multiplier. */
	intensity: number;
}

export interface VfxPreset {
	id: VideoEffectId;
	name: string;
}

export const VFX_PRESETS: VfxPreset[] = [
	{ id: "none", name: "None" },
	{ id: "glitch", name: "Glitch" },
	{ id: "vhs", name: "VHS" },
	{ id: "pixelate", name: "Pixelate" },
	{ id: "rgb-split", name: "RGB Split" },
	{ id: "halftone", name: "Halftone" },
];

/** Apply a video effect to a source frame, writing into `target`. */
export function applyVideoEffect({
	source,
	sourceWidth,
	sourceHeight,
	config,
	target,
}: {
	source: CanvasImageSource;
	sourceWidth: number;
	sourceHeight: number;
	config: VideoEffectConfig;
	target: DrawableCanvas;
}): DrawableCanvas {
	const ctx = target.getContext("2d") as Canvas2DContext | null;
	if (!ctx) return target;

	ctx.globalCompositeOperation = "source-over";
	ctx.clearRect(0, 0, sourceWidth, sourceHeight);
	ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight);

	if (config.effect === "none" || config.intensity <= 0) return target;

	const imageData = ctx.getImageData(0, 0, sourceWidth, sourceHeight);
	const data = imageData.data;
	const strength = config.intensity;

	switch (config.effect) {
		case "glitch":
			glitchEffect(data, sourceWidth, sourceHeight, strength);
			break;
		case "vhs":
			vhsEffect(data, sourceWidth, sourceHeight, strength);
			break;
		case "pixelate":
			pixelateEffect(data, sourceWidth, sourceHeight, strength);
			break;
		case "rgb-split":
			rgbSplitEffect(data, sourceWidth, sourceHeight, strength);
			break;
		case "halftone":
			halftoneEffect(data, sourceWidth, sourceHeight, strength);
			break;
	}

	ctx.putImageData(imageData, 0, 0);
	return target;
}

/** Glitch: RGB channel split + horizontal slice displacement. */
function glitchEffect(
	data: Uint8ClampedArray,
	width: number,
	height: number,
	strength: number,
): void {
	const offsetR = Math.round(strength * 8);
	const offsetB = Math.round(strength * 6);
	const sliceCount = Math.round(strength * 8);

	// RGB split: shift R left, B right.
	const copy = new Uint8ClampedArray(data);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			const rX = Math.max(0, x - offsetR);
			const bX = Math.min(width - 1, x + offsetB);
			data[i] = copy[(y * width + rX) * 4]; // R from shifted-left
			data[i + 2] = copy[(y * width + bX) * 4 + 2]; // B from shifted-right
		}
	}

	// Horizontal slice displacement.
	if (sliceCount > 0) {
		const sliceHeight = Math.floor(height / sliceCount);
		const displaced = new Uint8ClampedArray(data);
		for (let s = 0; s < sliceCount; s++) {
			if (Math.random() > strength) continue;
			const y0 = s * sliceHeight;
			const y1 = Math.min(height, y0 + sliceHeight);
			const shift = Math.round((Math.random() - 0.5) * strength * 40);
			for (let y = y0; y < y1; y++) {
				for (let x = 0; x < width; x++) {
					const srcX = Math.max(0, Math.min(width - 1, x + shift));
					const di = (y * width + x) * 4;
					const si = (y * width + srcX) * 4;
					data[di] = displaced[si];
					data[di + 1] = displaced[si + 1];
					data[di + 2] = displaced[si + 2];
				}
			}
		}
	}
}

/** VHS: scanline darkening + chroma noise. */
function vhsEffect(
	data: Uint8ClampedArray,
	width: number,
	height: number,
	strength: number,
): void {
	const scanlineDarken = 1 - strength * 0.3;
	for (let y = 0; y < height; y++) {
		const isScan = y % 2 === 0;
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			if (isScan) {
				data[i] = data[i] * scanlineDarken;
				data[i + 1] = data[i + 1] * scanlineDarken;
				data[i + 2] = data[i + 2] * scanlineDarken;
			}
			// Noise.
			const noise = (Math.random() - 0.5) * strength * 40;
			data[i] = clamp255(data[i] + noise);
			data[i + 1] = clamp255(data[i + 1] + noise);
			data[i + 2] = clamp255(data[i + 2] + noise);
		}
	}
}

/** Pixelate: block downsampling. */
function pixelateEffect(
	data: Uint8ClampedArray,
	width: number,
	height: number,
	strength: number,
): void {
	const blockSize = Math.max(2, Math.round(strength * 20));
	for (let by = 0; by < height; by += blockSize) {
		for (let bx = 0; bx < width; bx += blockSize) {
			// Sample the block's top-left pixel as the block color.
			const si = (by * width + bx) * 4;
			const r = data[si];
			const g = data[si + 1];
			const b = data[si + 2];
			const a = data[si + 3];
			for (let y = by; y < Math.min(height, by + blockSize); y++) {
				for (let x = bx; x < Math.min(width, bx + blockSize); x++) {
					const i = (y * width + x) * 4;
					data[i] = r;
					data[i + 1] = g;
					data[i + 2] = b;
					data[i + 3] = a;
				}
			}
		}
	}
}

/** RGB split: fixed channel offset (calmer than glitch — no slices). */
function rgbSplitEffect(
	data: Uint8ClampedArray,
	width: number,
	height: number,
	strength: number,
): void {
	const offset = Math.max(1, Math.round(strength * 10));
	const copy = new Uint8ClampedArray(data);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			const rX = Math.max(0, x - offset);
			const bX = Math.min(width - 1, x + offset);
			data[i] = copy[(y * width + rX) * 4];
			data[i + 2] = copy[(y * width + bX) * 4 + 2];
		}
	}
}

/** Halftone: dot-pattern dithering based on luminance. */
function halftoneEffect(
	data: Uint8ClampedArray,
	width: number,
	height: number,
	strength: number,
): void {
	const cellSize = Math.max(3, Math.round(4 + strength * 8));
	for (let by = 0; by < height; by += cellSize) {
		for (let bx = 0; bx < width; bx += cellSize) {
			// Average luminance over the cell.
			let lumaSum = 0;
			let count = 0;
			for (let y = by; y < Math.min(height, by + cellSize); y++) {
				for (let x = bx; x < Math.min(width, bx + cellSize); x++) {
					const i = (y * width + x) * 4;
					lumaSum +=
						0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
					count++;
				}
			}
			const avgLuma = count > 0 ? lumaSum / count : 0;
			// Fill the cell with the average color.
			const ci = (by * width + bx) * 4;
			const r = data[ci];
			const g = data[ci + 1];
			const b = data[ci + 2];
			for (let y = by; y < Math.min(height, by + cellSize); y++) {
				for (let x = bx; x < Math.min(width, bx + cellSize); x++) {
					const i = (y * width + x) * 4;
					// Dot mask: darker cells shrink toward center.
					const dx = x - bx - cellSize / 2;
					const dy = y - by - cellSize / 2;
					const dist = Math.sqrt(dx * dx + dy * dy);
					const radius = (avgLuma / 255) * (cellSize / 2);
					if (dist > radius) {
						data[i] = 0;
						data[i + 1] = 0;
						data[i + 2] = 0;
					} else {
						data[i] = r;
						data[i + 1] = g;
						data[i + 2] = b;
					}
				}
			}
		}
	}
}

function clamp255(n: number): number {
	return n < 0 ? 0 : n > 255 ? 255 : n;
}

/** Ensure a reusable vfx-target canvas of the given dimensions. */
export function ensureVfxTarget({
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
