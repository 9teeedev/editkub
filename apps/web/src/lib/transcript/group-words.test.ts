import { describe, expect, test } from "bun:test";
import {
	applyGroupTextEdit,
	buildCaptionGroups,
	buildSentenceSegments,
	extractWordsFromSegments,
	joinWordTexts,
} from "./group-words";
import type { TranscriptionSegment } from "@/types/transcription";
import { deriveCaptionElements } from "./derive-captions";
import type { TranscriptData } from "@/types/transcript";
import {
	isCaptionWordVisible,
	resolveCaptionFlowFrame,
} from "@/constants/caption-templates";

test("caption flow motion enters, progresses, and settles", () => {
	const start = resolveCaptionFlowFrame({ elapsed: 0, duration: 0.8 });
	const moving = resolveCaptionFlowFrame({ elapsed: 0.1, duration: 0.8 });
	const end = resolveCaptionFlowFrame({ elapsed: 2, duration: 0.8 });

	expect(start).toEqual({ progress: 0, entrance: 0, popScale: 0.65 });
	expect(moving.progress).toBeCloseTo(0.125);
	expect(moving.entrance).toBeGreaterThan(0.8);
	expect(moving.popScale).toBeGreaterThan(1);
	expect(end).toEqual({ progress: 1, entrance: 1, popScale: 1 });
});

test("pop flow hides future words and keeps revealed words visible", () => {
	expect(
		isCaptionWordVisible({ flow: "pop", localTime: 0.49, start: 0.5 }),
	).toBe(false);
	expect(
		isCaptionWordVisible({ flow: "pop", localTime: 0.5, start: 0.5 }),
	).toBe(true);
	expect(
		isCaptionWordVisible({ flow: "pop", localTime: 1, start: 0.5 }),
	).toBe(true);
	expect(
		isCaptionWordVisible({ flow: "color", localTime: 0, start: 0.5 }),
	).toBe(true);
});

describe("extractWordsFromSegments", () => {
	test("keeps exact timing for word-level segments", () => {
		const segments: TranscriptionSegment[] = [
			{ text: "hello", start: 0, end: 0.5 },
			{ text: "world", start: 0.5, end: 1.0 },
		];
		const { words, timing } = extractWordsFromSegments({ segments });
		expect(timing).toBe("precise");
		expect(words).toHaveLength(2);
		expect(words[0]).toEqual({ text: "hello", start: 0, end: 0.5 });
	});

	test("spreads segment-level words proportionally to length", () => {
		const segments: TranscriptionSegment[] = [
			{ text: "one two three", start: 2, end: 3 },
		];
		const { words, timing } = extractWordsFromSegments({ segments });
		expect(timing).toBe("estimated");
		expect(words.map((w) => w.text)).toEqual(["one", "two", "three"]);
		expect(words[0].start).toBe(2);
		expect(words[2].end).toBeCloseTo(3);
		// "three" (5 chars) is weighted longer than "one" (3 chars).
		const d0 = words[0].end - words[0].start;
		const d2 = words[2].end - words[2].start;
		expect(d2).toBeGreaterThan(d0);
	});

	test("handles empty segments", () => {
		const { words } = extractWordsFromSegments({
			segments: [{ text: "   ", start: 0, end: 1 }],
		});
		expect(words).toHaveLength(0);
	});

	test("dictionary-splits glued Thai phrases into words", () => {
		// Thai comes back without inter-word spaces — one segment must not
		// become one giant "word".
		const { words, timing } = extractWordsFromSegments({
			segments: [{ text: "สวัสดีครับผมชื่อนี่", start: 0, end: 2 }],
		});
		expect(words.length).toBeGreaterThan(2);
		expect(timing).toBe("estimated");
		// Timings are contiguous and cover the segment span.
		for (let i = 1; i < words.length; i++) {
			expect(words[i].start).toBeCloseTo(words[i - 1].end);
		}
		expect(words[0].start).toBe(0);
		expect(words[words.length - 1].end).toBeCloseTo(2);
	});
});

describe("buildSentenceSegments", () => {
	test("splits on sentence-ending punctuation", () => {
		const words = [
			{ text: "Hi", start: 0, end: 0.3 },
			{ text: "there.", start: 0.3, end: 0.6 },
			{ text: "Bye", start: 0.7, end: 1.0 },
		];
		const segments = buildSentenceSegments({ words });
		expect(segments).toHaveLength(2);
		expect(segments[0].text).toBe("Hi there.");
		expect(segments[1].text).toBe("Bye");
	});

	test("splits on speech gaps", () => {
		const words = [
			{ text: "a", start: 0, end: 0.2 },
			{ text: "b", start: 1.5, end: 1.7 },
		];
		const segments = buildSentenceSegments({ words });
		expect(segments).toHaveLength(2);
		expect(segments[0].end).toBe(0.2);
		expect(segments[1].start).toBe(1.5);
	});

	test("keeps no-gap unpunctuated words in one sentence", () => {
		const words = [
			{ text: "a", start: 0, end: 0.2 },
			{ text: "b", start: 0.25, end: 0.45 },
			{ text: "c", start: 0.5, end: 0.7 },
		];
		const segments = buildSentenceSegments({ words });
		expect(segments).toHaveLength(1);
		expect(segments[0].words).toHaveLength(3);
	});
});

describe("buildCaptionGroups", () => {
	const segments = [
		{
			id: "seg-0",
			text: "one two three four",
			start: 0,
			end: 2,
			words: [
				{ text: "one", start: 0, end: 0.5 },
				{ text: "two", start: 0.5, end: 1.0 },
				{ text: "three", start: 1.0, end: 1.5 },
				{ text: "four", start: 1.5, end: 2.0 },
			],
		},
		{
			id: "seg-1",
			text: "five",
			start: 2.2,
			end: 2.5,
			words: [{ text: "five", start: 2.2, end: 2.5 }],
		},
	];

	test("chunks by wordsPerGroup without crossing sentences", () => {
		const groups = buildCaptionGroups({ segments, wordsPerGroup: 3 });
		expect(groups).toHaveLength(3);
		expect(groups[0].words.map((w) => w.text)).toEqual([
			"one",
			"two",
			"three",
		]);
		expect(groups[1].words.map((w) => w.text)).toEqual(["four"]);
		expect(groups[2].words.map((w) => w.text)).toEqual(["five"]);
		expect(groups[1].id).toBe("seg-0:1");
	});

	test("enforces a minimum element span", () => {
		const tiny = [
			{
				id: "seg-0",
				text: "hi",
				start: 0,
				end: 0.1,
				words: [{ text: "hi", start: 0, end: 0.1 }],
			},
		];
		const groups = buildCaptionGroups({ segments: tiny, wordsPerGroup: 3 });
		expect(groups[0].end - groups[0].start).toBeGreaterThanOrEqual(0.3);
	});
});

describe("joinWordTexts", () => {
	test("joins non-Thai with spaces", () => {
		expect(joinWordTexts(["hello", "world"])).toBe("hello world");
	});

	test("joins Thai without spaces", () => {
		expect(joinWordTexts(["สวัสดี", "ครับ"])).toBe("สวัสดีครับ");
	});
});

describe("applyGroupTextEdit", () => {
	test("spreads edited tokens across the group span", () => {
		const words = [
			{ text: "a", start: 1, end: 1.4 },
			{ text: "b", start: 1.4, end: 2 },
		];
		const edited = applyGroupTextEdit({ words, text: "x y z" });
		expect(edited.map((w) => w.text)).toEqual(["x", "y", "z"]);
		expect(edited[0].start).toBe(1);
		expect(edited[2].end).toBeCloseTo(2);
	});

	test("empty text yields no words", () => {
		const edited = applyGroupTextEdit({
			words: [{ text: "a", start: 0, end: 1 }],
			text: "   ",
		});
		expect(edited).toHaveLength(0);
	});
});

describe("deriveCaptionElements", () => {
	const transcript: TranscriptData = {
		language: "en",
		createdAt: "2026-08-26T00:00:00.000Z",
		providerId: "local",
		modelId: "whisper-base",
		wordTiming: "precise",
		wordsPerGroup: 2,
		templateId: "flow-karaoke-fill",
		accentColor: "#22d3ee",
		captionTrackId: null,
		segments: [
			{
				id: "seg-0",
				text: "hello world",
				start: 1,
				end: 2,
				words: [
					{ text: "hello", start: 1, end: 1.5 },
					{ text: "world", start: 1.5, end: 2 },
				],
			},
		],
	};

	test("derives element-local word timings and caption style", () => {
		const elements = deriveCaptionElements({ transcript });
		expect(elements).toHaveLength(1);
		const element = elements[0];
		expect(element.startTime).toBe(1);
		expect(element.duration).toBe(1);
		expect(element.wordTimings).toEqual([
			{ text: "hello", start: 0, end: 0.5 },
			{ text: "world", start: 0.5, end: 1 },
		]);
		expect(element.captionStyle).toEqual({
			flow: "fill",
			accentColor: "#22d3ee",
		});
		expect(element.content).toBe("hello world");
	});
});
