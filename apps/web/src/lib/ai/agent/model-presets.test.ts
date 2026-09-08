import { describe, expect, test } from "bun:test";
import {
	DEFAULT_CONTEXT_WINDOW,
	findModelPreset,
	formatTokens,
	getContextWindow,
} from "./model-presets";

describe("findModelPreset", () => {
	test("matches exact id case-insensitively", () => {
		expect(findModelPreset({ model: "GPT-5.2" })?.contextWindow).toBe(400_000);
		expect(findModelPreset({ model: "glm-5.3" })?.contextWindow).toBe(350_000);
	});

	test("matches variants via prefix", () => {
		expect(findModelPreset({ model: "gpt-5.2-mini" })?.id).toBe("gpt-5.2");
		expect(findModelPreset({ model: "gemini-2.5-pro-preview" })?.id).toBe(
			"gemini-2.5-pro",
		);
	});

	test("does not match lookalike prefixes", () => {
		expect(findModelPreset({ model: "gpt-4" })).toBeNull();
		expect(findModelPreset({ model: "my-custom-model" })).toBeNull();
	});

	test("empty model resolves to null", () => {
		expect(findModelPreset({ model: "" })).toBeNull();
		expect(findModelPreset({ model: "   " })).toBeNull();
	});
});

describe("getContextWindow", () => {
	test("uses preset window when model matches", () => {
		expect(getContextWindow({ model: "gpt-4.1", fallback: 8_000 })).toBe(
			1_000_000,
		);
	});

	test("falls back for unknown models", () => {
		expect(getContextWindow({ model: "llama-3", fallback: 200_000 })).toBe(
			200_000,
		);
	});

	test("ignores non-positive fallbacks", () => {
		expect(getContextWindow({ model: "llama-3", fallback: 0 })).toBe(
			DEFAULT_CONTEXT_WINDOW,
		);
	});
});

describe("formatTokens", () => {
	test("formats compact units", () => {
		expect(formatTokens(0)).toBe("0");
		expect(formatTokens(850)).toBe("850");
		expect(formatTokens(123_456)).toBe("123K");
		expect(formatTokens(1_050_000)).toBe("1.1M");
		expect(formatTokens(12_000_000)).toBe("12M");
	});

	test("handles invalid input", () => {
		expect(formatTokens(Number.NaN)).toBe("0");
		expect(formatTokens(-5)).toBe("0");
	});
});
