import { describe, it, expect } from "bun:test";
import {
	computeCER,
	computeWER,
	levenshteinDistance,
	normalizeTranscript,
	tokenizeWords,
	calculatePercentiles,
	evaluateBenchmark,
	type BenchmarkInput,
} from "./calculator";

describe("Caption Benchmark Calculator", () => {
	describe("Normalization", () => {
		it("normalizes NFC Unicode, lowercases, and strips punctuation", () => {
			const raw = "สวัสดี, ครับ!! Hello WORLD... 123";
			expect(normalizeTranscript(raw)).toBe("สวัสดี ครับ hello world 123");
		});
	});

	describe("Levenshtein Distance", () => {
		it("calculates edit distance accurately", () => {
			expect(levenshteinDistance([], [])).toBe(0);
			expect(levenshteinDistance(["a", "b"], ["a", "b"])).toBe(0);
			expect(levenshteinDistance(["a", "b"], ["a", "c"])).toBe(1);
			expect(levenshteinDistance(["a", "b"], ["a"])).toBe(1);
			expect(levenshteinDistance(["a"], ["a", "b", "c"])).toBe(2);
		});
	});

	describe("Thai Character Error Rate (CER)", () => {
		it("returns 0 for identical Thai strings regardless of spaces", () => {
			const ref = "สวัสดีครับ วันนี้";
			const hyp = "สวัสดี ครับ วันนี้";
			expect(computeCER(ref, hyp)).toBe(0);
		});

		it("computes ratio correctly when characters differ", () => {
			const ref = "สวัสดี"; // 6 characters
			const hyp = "สวัสดึ"; // 1 substitution
			expect(computeCER(ref, hyp)).toBeCloseTo(1 / 6, 4);
		});

		it("handles empty strings", () => {
			expect(computeCER("", "")).toBe(0);
			expect(computeCER("สวัสดี", "")).toBe(1);
		});
	});

	describe("Word Error Rate (WER) with Intl.Segmenter", () => {
		it("segments Thai words using Intl.Segmenter", () => {
			const words = tokenizeWords("สวัสดีชาวโลก");
			expect(words).toEqual(["สวัสดี", "ชาว", "โลก"]);
		});

		it("returns 0 for matching segmented words", () => {
			const ref = "สวัสดีชาวโลก";
			const hyp = "สวัสดีชาวโลก";
			expect(computeWER(ref, hyp)).toBe(0);
		});

		it("computes word errors correctly", () => {
			const ref = "สวัสดีชาวโลก"; // 3 words: สวัสดี, ชาว, โลก
			const hyp = "สวัสดีชาวไทย"; // 1 word substitution: ไทย instead of โลก
			expect(computeWER(ref, hyp)).toBeCloseTo(1 / 3, 4);
		});
	});

	describe("Percentiles", () => {
		it("calculates median and p95 correctly", () => {
			const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			const { median, p95 } = calculatePercentiles(values);
			expect(median).toBe(5.5);
			expect(p95).toBe(10);
		});
	});

	describe("Benchmark Evaluation Aggregation", () => {
		it("evaluates a synthetic benchmark input correctly", () => {
			const input: BenchmarkInput = {
				samples: [
					{
						sampleId: "sample-1",
						category: "clear_thai",
						audioDuration: 10,
						referenceTranscript: "สวัสดีครับ",
						results: [
							{
								mode: "local",
								provider: "local-whisper",
								hypothesisTranscript: "สวัสดี ครับ",
								processingLatency: 2.0,
								cost: 0,
							},
							{
								mode: "remote",
								provider: "cloud-whisper",
								hypothesisTranscript: "สวัสดีครับ",
								processingLatency: 0.5,
								cost: 0.001,
							},
						],
					},
					{
						sampleId: "sample-2",
						category: "clear_thai",
						audioDuration: 20,
						referenceTranscript: "ทดสอบการใช้งาน",
						results: [
							{
								mode: "local",
								provider: "local-whisper",
								hypothesisTranscript: "ทดสอบ การ ใช้งาน",
								processingLatency: 4.0,
								cost: 0,
							},
							{
								mode: "remote",
								provider: "cloud-whisper",
								hypothesisTranscript: "ทดสอบการใช้งาน",
								processingLatency: 1.0,
								cost: 0.002,
							},
						],
					},
				],
			};

			const metrics = evaluateBenchmark(input);
			expect(metrics.length).toBe(2);

			const local = metrics.find((m) => m.provider === "local-whisper");
			const remote = metrics.find((m) => m.provider === "cloud-whisper");

			expect(local).toBeDefined();
			expect(local?.medianCer).toBe(0);
			expect(local?.medianLatency).toBe(3.0);
			expect(local?.costPerAudioMinute).toBe(0);

			expect(remote).toBeDefined();
			expect(remote?.medianCer).toBe(0);
			expect(remote?.medianLatency).toBe(0.75);
			// Total cost = 0.003 for 30s audio = 0.006 per minute
			expect(remote?.costPerAudioMinute).toBeCloseTo(0.006, 4);
		});
	});
});
