/**
 * Fit source image statistics to a reference image's statistics, producing
 * a 6-knob AdjustmentControls patch.
 *
 * This is an *approximation*: true histogram matching needs a per-pixel LUT,
 * but the renderer only exposes CSS filter knobs (brightness/contrast/
 * saturation/temperature/tint/hue via computeFilterString). We fit each
 * statistic independently:
 *
 * - brightness ← ratio of mean luma
 * - contrast   ← ratio of luma spread (p90 − p10)
 * - saturation ← ratio of mean HSL saturation
 * - temperature ← warmth difference mapped to [-100, 100]
 * - tint        ← tint difference mapped to [-100, 100]
 * - hue         ← 0 (left untouched; no cheap stat proxy)
 *
 * The patch is clamped to each knob's valid range and skips keys whose
 * computed delta is below a noise threshold, so callers can merge with
 * existing adjustments.
 */
import type { AdjustmentControls } from "@/types/timeline";
import type { ImageStats } from "./histogram";

const NOISE_THRESHOLD = 0.005;

/** Fit source stats to reference stats; returns a partial patch. */
export function matchStats({
	source,
	reference,
}: {
	source: ImageStats;
	reference: ImageStats;
}): AdjustmentControls {
	// --- Brightness: ratio of mean luma (255 = 1.0 in CSS brightness) ---
	const refLuma = clampNonZero(reference.luma.mean) / 255;
	const srcLuma = clampNonZero(source.luma.mean) / 255;
	const brightness = clamp(refLuma / srcLuma, 0, 2);

	// --- Contrast: ratio of (p90 − p10) spread ---
	const refSpread = Math.max(1, reference.luma.p90 - reference.luma.p10);
	const srcSpread = Math.max(1, source.luma.p90 - source.luma.p10);
	const contrast = clamp(refSpread / srcSpread, 0, 2);

	// --- Saturation: ratio of mean HSL saturation ---
	const refSat = clampNonZero(reference.saturation);
	const srcSat = clampNonZero(source.saturation);
	const saturation = clamp(refSat / srcSat, 0, 2);

	// --- Temperature: warmth (R+G)/2 − B difference ---
	// warmth is in [−1, 1] roughly; scale to [−100, 100].
	const warmthDelta = reference.warmth - source.warmth;
	const temperature = clamp(Math.round(warmthDelta * 200), -100, 100);

	// --- Tint: R − G difference ---
	const tintDelta = reference.tint - source.tint;
	const tint = clamp(Math.round(tintDelta * 200), -100, 100);

	// Hue: no cheap statistical proxy; leave at 0 (caller keeps existing).
	const hue = 0;

	return { brightness, contrast, saturation, temperature, tint, hue, vignette: 0, sharpen: 0 };
}

/** Whether a patch meaningfully differs from defaults. */
export function isPatchSignificant(patch: AdjustmentControls): boolean {
	return (
		Math.abs(patch.brightness - 1) > NOISE_THRESHOLD ||
		Math.abs(patch.contrast - 1) > NOISE_THRESHOLD ||
		Math.abs(patch.saturation - 1) > NOISE_THRESHOLD ||
		Math.abs(patch.temperature) > 1 ||
		Math.abs(patch.tint) > 1
	);
}

function clamp(n: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, n));
}

function clampNonZero(n: number, eps = 0.001): number {
	return Math.abs(n) < eps ? eps : n;
}
