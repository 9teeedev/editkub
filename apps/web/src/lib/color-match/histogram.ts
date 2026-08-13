/**
 * Color histogram + CDF utilities for histogram matching.
 *
 * Pure domain logic (per AGENTS.md → lives in `lib/`). Operates on raw
 * pixel data (Uint8ClampedArray RGBA) and builds per-channel histograms
 * + cumulative distribution functions for distribution comparison.
 *
 * Note: full histogram matching would require a per-pixel LUT. This module
 * provides the *statistics* that the matcher fits to the 6-knob
 * AdjustmentControls model (brightness/contrast/saturation/temperature/tint).
 */

/** Per-channel histogram (256 buckets each). */
export interface Histogram {
	r: Float32Array; // normalized [0,1]
	g: Float32Array;
	b: Float32Array;
	luma: Float32Array;
}

/** Per-channel statistics. */
export interface ChannelStats {
	mean: number; // [0,255]
	median: number; // [0,255]
	stdDev: number; // [0,127]
	p10: number; // 10th percentile [0,255]
	p90: number; // 90th percentile [0,255]
}

export interface ImageStats {
	luma: ChannelStats;
	r: ChannelStats;
	g: ChannelStats;
	b: ChannelStats;
	/** Mean saturation in HSL space, [0,1]. */
	saturation: number;
	/** Mean (R+G)/2 − B, used as a warm/cool proxy. >0 = warm. */
	warmth: number;
	/** Mean R − G, used as a magenta/green tint proxy. >0 = magenta. */
	tint: number;
}

/** Build a normalized histogram from RGBA pixel data. */
export function buildHistogram(data: Uint8ClampedArray): Histogram {
	const r = new Float32Array(256);
	const g = new Float32Array(256);
	const b = new Float32Array(256);
	const luma = new Float32Array(256);

	let count = 0;
	for (let i = 0; i < data.length; i += 4) {
		const R = data[i];
		const G = data[i + 1];
		const B = data[i + 2];
		const A = data[i + 3];
		if (A < 16) continue; // skip transparent

		r[R]++;
		g[G]++;
		b[B]++;
		// Rec. 709 luma
		const Y = (0.2126 * R + 0.7152 * G + 0.0722 * B) | 0;
		luma[Y]++;
		count++;
	}

	if (count === 0) count = 1;
	const inv = 1 / count;
	for (let i = 0; i < 256; i++) {
		r[i] *= inv;
		g[i] *= inv;
		b[i] *= inv;
		luma[i] *= inv;
	}

	return { r, g, b, luma };
}

/** Compute cumulative distribution function from a normalized histogram. */
export function cdf(hist: Float32Array): Float32Array {
	const out = new Float32Array(256);
	let acc = 0;
	for (let i = 0; i < 256; i++) {
		acc += hist[i];
		out[i] = acc;
	}
	return out;
}

/** Percentile value of a normalized histogram (e.g. 0.5 = median). */
function percentile(hist: Float32Array, p: number): number {
	const cum = cdf(hist);
	const target = p;
	for (let i = 0; i < 256; i++) {
		if (cum[i] >= target) return i;
	}
	return 255;
}

/** Compute per-channel statistics from a normalized histogram. */
function statsFromHist(hist: Float32Array): ChannelStats {
	let mean = 0;
	for (let i = 0; i < 256; i++) mean += i * hist[i];

	let variance = 0;
	for (let i = 0; i < 256; i++) {
		const d = i - mean;
		variance += d * d * hist[i];
	}

	return {
		mean,
		median: percentile(hist, 0.5),
		stdDev: Math.sqrt(variance),
		p10: percentile(hist, 0.1),
		p90: percentile(hist, 0.9),
	};
}

/**
 * Aggregate image statistics from RGBA pixel data.
 * Downsamples large images for speed (every Nth pixel).
 */
export function computeStats(data: Uint8ClampedArray): ImageStats {
	const hist = buildHistogram(data);

	// Saturation + warmth/tint need HSL conversion; sample every Nth pixel.
	let satSum = 0;
	let warmSum = 0;
	let tintSum = 0;
	let sampleCount = 0;
	const step = 4 * 4; // every 4th pixel
	for (let i = 0; i < data.length; i += step) {
		const R = data[i] / 255;
		const G = data[i + 1] / 255;
		const B = data[i + 2] / 255;
		const A = data[i + 3];
		if (A < 16) continue;

		const max = Math.max(R, G, B);
		const min = Math.min(R, G, B);
		const delta = max - min;
		const light = (max + min) / 2;
		let s = 0;
		if (delta > 0) {
			s = delta / (1 - Math.abs(2 * light - 1));
		}
		satSum += s;
		warmSum += (R + G) / 2 - B;
		tintSum += R - G;
		sampleCount++;
	}
	sampleCount = Math.max(1, sampleCount);

	return {
		luma: statsFromHist(hist.luma),
		r: statsFromHist(hist.r),
		g: statsFromHist(hist.g),
		b: statsFromHist(hist.b),
		saturation: satSum / sampleCount,
		warmth: warmSum / sampleCount,
		tint: tintSum / sampleCount,
	};
}
