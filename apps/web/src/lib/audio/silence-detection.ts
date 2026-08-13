/**
 * Silence detection via RMS windowing.
 *
 * Pure domain logic (per AGENTS.md → lives in `lib/`). Given mono PCM
 * samples (Float32Array, [-1,1]) and a sample rate, computes per-window
 * RMS amplitude and returns contiguous runs of windows below a threshold
 * as time-ranged silence segments.
 *
 * The algorithm:
 *  1. Slide a window (default 50ms) across the samples.
 *  2. Compute RMS per window.
 *  3. Convert to dBFS (20·log10(rms)).
 *  4. A window is "silent" if dBFS ≤ threshold (default −40 dB).
 *  5. Merge consecutive silent windows into segments.
 *  6. Drop segments shorter than minDuration (default 0.3s) — too short
 *     to be a real pause worth cutting.
 *  7. Pad each segment's edges inward by padMs so we don't clip speech
 *     that bleeds into the silent window.
 */

export interface SilenceSegment {
	/** Start time in seconds, relative to the source audio. */
	start: number;
	/** End time in seconds, relative to the source audio. */
	end: number;
}

export interface SilenceDetectionOptions {
	/** Threshold in dBFS (negative). Windows ≤ this are silent. */
	threshold?: number;
	/** Analysis window size in seconds. */
	windowSize?: number;
	/** Minimum silence duration to report (seconds). */
	minDuration?: number;
	/** Padding kept around each silent segment (seconds, each side). */
	pad?: number;
}

const DEFAULTS: Required<SilenceDetectionOptions> = {
	threshold: -40,
	windowSize: 0.05,
	minDuration: 0.3,
	pad: 0.05,
};

/**
 * Detect silent segments in mono PCM audio.
 * Returns segments sorted by start time, non-overlapping.
 */
export function detectSilence(
	samples: Float32Array,
	sampleRate: number,
	options: SilenceDetectionOptions = {},
): SilenceSegment[] {
	const opts = { ...DEFAULTS, ...options };
	const winSamples = Math.max(1, Math.round(opts.windowSize * sampleRate));
	const minWindows = Math.ceil(opts.minDuration / opts.windowSize);

	// Step 1: per-window RMS in dBFS.
	const windowSilent: boolean[] = [];
	for (let i = 0; i < samples.length; i += winSamples) {
		let sumSq = 0;
		let count = 0;
		const end = Math.min(i + winSamples, samples.length);
		for (let j = i; j < end; j++) {
			sumSq += samples[j] * samples[j];
			count++;
		}
		const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
		const db = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
		windowSilent.push(db <= opts.threshold);
	}

	// Step 2: merge consecutive silent windows into runs.
	const runs: { startWindow: number; endWindow: number }[] = [];
	let runStart = -1;
	for (let i = 0; i < windowSilent.length; i++) {
		if (windowSilent[i] && runStart === -1) {
			runStart = i;
		} else if (!windowSilent[i] && runStart !== -1) {
			if (i - runStart >= minWindows) {
				runs.push({ startWindow: runStart, endWindow: i });
			}
			runStart = -1;
		}
	}
	if (runStart !== -1 && windowSilent.length - runStart >= minWindows) {
		runs.push({ startWindow: runStart, endWindow: windowSilent.length });
	}

	// Step 3: convert window indices → seconds, pad inward.
	const segments: SilenceSegment[] = [];
	for (const run of runs) {
		const start = run.startWindow * opts.windowSize + opts.pad;
		const end = run.endWindow * opts.windowSize - opts.pad;
		if (end > start) {
			segments.push({ start, end });
		}
	}

	return mergeOverlapping(segments);
}

/** Merge overlapping/adjacent segments. */
function mergeOverlapping(segments: SilenceSegment[]): SilenceSegment[] {
	if (segments.length === 0) return [];
	const sorted = [...segments].sort((a, b) => a.start - b.start);
	const merged: SilenceSegment[] = [sorted[0]];
	for (let i = 1; i < sorted.length; i++) {
		const last = merged[merged.length - 1];
		if (sorted[i].start <= last.end) {
			last.end = Math.max(last.end, sorted[i].end);
		} else {
			merged.push(sorted[i]);
		}
	}
	return merged;
}

/**
 * Invert silence segments to get the "kept" (non-silent) ranges over [0, duration].
 * These are the segments the user wants to retain.
 */
export function invertSegments(
	silence: SilenceSegment[],
	duration: number,
): SilenceSegment[] {
	if (silence.length === 0) return [{ start: 0, end: duration }];
	const kept: SilenceSegment[] = [];
	let cursor = 0;
	for (const seg of silence) {
		if (seg.start > cursor) {
			kept.push({ start: cursor, end: seg.start });
		}
		cursor = seg.end;
	}
	if (cursor < duration) {
		kept.push({ start: cursor, end: duration });
	}
	return kept;
}
