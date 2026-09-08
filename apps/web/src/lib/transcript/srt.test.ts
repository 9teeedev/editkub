import { describe, expect, test } from "bun:test";
import {
	formatSrtTimestamp,
	parseSrt,
	serializeSrt,
	srtCuesToTranscriptionSegments,
} from "./srt";

describe("formatSrtTimestamp", () => {
	test("formats hours, minutes, seconds and milliseconds", () => {
		expect(formatSrtTimestamp({ time: 0 })).toBe("00:00:00,000");
		expect(formatSrtTimestamp({ time: 3661.5 })).toBe("01:01:01,500");
		expect(formatSrtTimestamp({ time: 12.345 })).toBe("00:00:12,345");
	});

	test("clamps negative time", () => {
		expect(formatSrtTimestamp({ time: -5 })).toBe("00:00:00,000");
	});
});

describe("parseSrt", () => {
	test("parses a well-formed file", () => {
		const cues = parseSrt({
			text: [
				"1",
				"00:00:01,000 --> 00:00:02,500",
				"Hello world",
				"",
				"2",
				"00:00:03,000 --> 00:00:04,000",
				"Second cue",
			].join("\n"),
		});

		expect(cues).toEqual([
			{ start: 1, end: 2.5, text: "Hello world" },
			{ start: 3, end: 4, text: "Second cue" },
		]);
	});

	test("handles CRLF line endings and a BOM", () => {
		const text = "\uFEFF1\r\n00:00:00,500 --> 00:00:01,000\r\nสวัสดีครับ\r\n";
		const cues = parseSrt({ text });
		expect(cues).toEqual([{ start: 0.5, end: 1, text: "สวัสดีครับ" }]);
	});

	test("accepts dot milliseconds and missing hours", () => {
		const cues = parseSrt({
			text: "00:01.500 --> 00:02.750\nNo index, dot millis",
		});
		expect(cues).toEqual([
			{ start: 1.5, end: 2.75, text: "No index, dot millis" },
		]);
	});

	test("joins multi-line cue text with newlines", () => {
		const cues = parseSrt({
			text: "1\n00:00:00,000 --> 00:00:05,000\nLine one\nLine two",
		});
		expect(cues[0]?.text).toBe("Line one\nLine two");
	});

	test("skips malformed blocks silently", () => {
		const cues = parseSrt({
			text: [
				"not a cue at all",
				"",
				"1",
				"00:00:01,000 --> 00:00:02,000",
				"Valid",
			].join("\n"),
		});
		expect(cues).toEqual([{ start: 1, end: 2, text: "Valid" }]);
	});

	test("end before start is clamped to start", () => {
		const cues = parseSrt({
			text: "1\n00:00:05,000 --> 00:00:04,000\nBackwards",
		});
		expect(cues[0]).toEqual({ start: 5, end: 5, text: "Backwards" });
	});
});

describe("serializeSrt / parseSrt round trip", () => {
	test("round trips cues including Thai text", () => {
		const cues = [
			{ start: 0, end: 1.2, text: "เราหน้าตา" },
			{ start: 2, end: 3.456, text: "Second line" },
		];
		const serialized = serializeSrt({ cues });
		expect(parseSrt({ text: serialized })).toEqual(cues);
	});
});

describe("srtCuesToTranscriptionSegments", () => {
	test("flattens multi-line text to single-line segments", () => {
		const segments = srtCuesToTranscriptionSegments({
			cues: [{ start: 1, end: 2, text: "Line one\nLine two" }],
		});
		expect(segments).toEqual([
			{ start: 1, end: 2, text: "Line one Line two" },
		]);
	});
});
