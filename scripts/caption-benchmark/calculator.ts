/**
 * Thai caption benchmark metrics calculator.
 * Computes CER, WER with native Intl.Segmenter, latency percentiles, RTF, and cost.
 */

export interface BenchmarkResult {
	mode: "local" | "remote";
	provider: string;
	hypothesisTranscript?: string;
	processingLatency: number; // seconds
	cost?: number; // USD
	error?: string;
}

export interface BenchmarkSample {
	sampleId: string;
	category: string;
	audioDuration: number; // seconds
	referenceTranscript: string;
	results: BenchmarkResult[];
}

export interface BenchmarkInput {
	samples: BenchmarkSample[];
}

export interface ProviderMetrics {
	provider: string;
	mode: "local" | "remote";
	totalSamples: number;
	successfulSamples: number;
	failureRate: number; // 0.0 - 1.0
	meanCer: number; // 0.0 - 1.0+
	medianCer: number;
	meanWer: number;
	medianWer: number;
	medianLatency: number; // seconds
	p95Latency: number; // seconds
	medianRtf: number;
	costPerAudioMinute: number | null; // USD
}

/**
 * Consistently normalizes Unicode (NFC), lowercases, and strips punctuation.
 */
export function normalizeTranscript(text: string): string {
	if (!text) return "";
	return (
		text
			.normalize("NFC")
			.toLowerCase()
			// Remove punctuation and typographic symbols while preserving letters, numbers, and Thai marks
			.replace(/[\p{P}\p{S}\p{Control}]/gu, "")
			.replace(/\s+/g, " ")
			.trim()
	);
}

/**
 * Computes Levenshtein distance between two sequences (characters or tokens).
 */
export function levenshteinDistance<T>(a: T[], b: T[]): number {
	const m = a.length;
	const n = b.length;

	if (m === 0) return n;
	if (n === 0) return m;

	let prev: number[] = Array.from({ length: n + 1 }, (_, i) => i);
	let curr: number[] = new Array(n + 1).fill(0);

	for (let i = 1; i <= m; i++) {
		curr[0] = i;
		for (let j = 1; j <= n; j++) {
			if (a[i - 1] === b[j - 1]) {
				curr[j] = prev[j - 1];
			} else {
				curr[j] = 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
			}
		}
		[prev, curr] = [curr, prev];
	}

	return prev[n];
}

/**
 * Computes Character Error Rate (CER) for Thai text.
 * Compares non-whitespace character sequences.
 */
export function computeCER(reference: string, hypothesis: string): number {
	const refNorm = normalizeTranscript(reference).replace(/\s+/g, "");
	const hypNorm = normalizeTranscript(hypothesis).replace(/\s+/g, "");

	const refChars = Array.from(refNorm);
	const hypChars = Array.from(hypNorm);

	if (refChars.length === 0) {
		return hypChars.length === 0 ? 0 : 1;
	}

	const dist = levenshteinDistance(refChars, hypChars);
	return dist / refChars.length;
}

/**
 * Tokenizes text into words using native Intl.Segmenter.
 */
export function tokenizeWords(text: string, locale = "th"): string[] {
	const norm = normalizeTranscript(text);
	if (!norm) return [];

	if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
		const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
		const segments = Array.from(segmenter.segment(norm));
		return segments
			.filter((s) => s.isWordLike)
			.map((s) => s.segment.trim())
			.filter((s) => s.length > 0);
	}

	// Fallback when Intl.Segmenter is unavailable
	return norm.split(/\s+/).filter(Boolean);
}

/**
 * Computes Word Error Rate (WER) using segmented word tokens.
 */
export function computeWER(
	reference: string,
	hypothesis: string,
	locale = "th",
): number {
	const refWords = tokenizeWords(reference, locale);
	const hypWords = tokenizeWords(hypothesis, locale);

	if (refWords.length === 0) {
		return hypWords.length === 0 ? 0 : 1;
	}

	const dist = levenshteinDistance(refWords, hypWords);
	return dist / refWords.length;
}

/**
 * Calculates median and p95 from a numeric list.
 */
export function calculatePercentiles(values: number[]): {
	median: number;
	p95: number;
} {
	if (values.length === 0) return { median: 0, p95: 0 };
	const sorted = [...values].sort((a, b) => a - b);

	const mid = Math.floor(sorted.length / 2);
	const median =
		sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

	const p95Index = Math.min(
		sorted.length - 1,
		Math.ceil(0.95 * sorted.length) - 1,
	);
	const p95 = sorted[p95Index];

	return { median, p95 };
}

/**
 * Evaluates all results grouped by provider.
 */
export function evaluateBenchmark(input: BenchmarkInput): ProviderMetrics[] {
	// Group runs by provider
	const byProvider = new Map<
		string,
		{
			mode: "local" | "remote";
			cers: number[];
			wers: number[];
			latencies: number[];
			rtfs: number[];
			costs: number[];
			audioDurations: number[];
			totalRuns: number;
			failedRuns: number;
		}
	>();

	for (const sample of input.samples) {
		for (const res of sample.results) {
			let group = byProvider.get(res.provider);
			if (!group) {
				group = {
					mode: res.mode,
					cers: [],
					wers: [],
					latencies: [],
					rtfs: [],
					costs: [],
					audioDurations: [],
					totalRuns: 0,
					failedRuns: 0,
				};
				byProvider.set(res.provider, group);
			}

			group.totalRuns += 1;

			const isFailed =
				Boolean(res.error) ||
				res.hypothesisTranscript === undefined ||
				(sample.referenceTranscript.trim().length > 0 &&
					res.hypothesisTranscript.trim().length === 0);

			if (isFailed) {
				group.failedRuns += 1;
				continue;
			}

			const hyp = res.hypothesisTranscript ?? "";
			const cer = computeCER(sample.referenceTranscript, hyp);
			const wer = computeWER(sample.referenceTranscript, hyp, "th");
			const rtf =
				sample.audioDuration > 0
					? res.processingLatency / sample.audioDuration
					: 0;

			group.cers.push(cer);
			group.wers.push(wer);
			group.latencies.push(res.processingLatency);
			group.rtfs.push(rtf);
			if (typeof res.cost === "number") {
				group.costs.push(res.cost);
				group.audioDurations.push(sample.audioDuration);
			}
		}
	}

	const metrics: ProviderMetrics[] = [];

	for (const [provider, g] of byProvider.entries()) {
		const successCount = g.cers.length;
		const { median: medianCer } = calculatePercentiles(g.cers);
		const { median: medianWer } = calculatePercentiles(g.wers);
		const { median: medianLatency, p95: p95Latency } = calculatePercentiles(
			g.latencies,
		);
		const { median: medianRtf } = calculatePercentiles(g.rtfs);

		const meanCer =
			g.cers.length > 0 ? g.cers.reduce((a, b) => a + b, 0) / g.cers.length : 0;
		const meanWer =
			g.wers.length > 0 ? g.wers.reduce((a, b) => a + b, 0) / g.wers.length : 0;

		let costPerAudioMinute: number | null = null;
		if (g.costs.length > 0) {
			const totalCost = g.costs.reduce((a, b) => a + b, 0);
			const totalDurationSec = g.audioDurations.reduce((a, b) => a + b, 0);
			if (totalDurationSec > 0) {
				costPerAudioMinute = (totalCost / totalDurationSec) * 60;
			}
		}

		metrics.push({
			provider,
			mode: g.mode,
			totalSamples: g.totalRuns,
			successfulSamples: successCount,
			failureRate: g.totalRuns > 0 ? g.failedRuns / g.totalRuns : 0,
			meanCer,
			medianCer,
			meanWer,
			medianWer,
			medianLatency,
			p95Latency,
			medianRtf,
			costPerAudioMinute,
		});
	}

	return metrics;
}
