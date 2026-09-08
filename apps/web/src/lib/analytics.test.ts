import { describe, it, expect, mock } from "bun:test";
import {
	getDurationBucket,
	getProcessingTimeBucket,
	normalizeErrorCategory,
	sanitizePayload,
	trackEvent,
} from "./analytics";

describe("Analytics Module", () => {
	it("correctly buckets media duration", () => {
		expect(getDurationBucket(10)).toBe("under_1m");
		expect(getDurationBucket(59.9)).toBe("under_1m");
		expect(getDurationBucket(60)).toBe("1_to_5m");
		expect(getDurationBucket(299)).toBe("1_to_5m");
		expect(getDurationBucket(300)).toBe("5_to_15m");
		expect(getDurationBucket(899)).toBe("5_to_15m");
		expect(getDurationBucket(900)).toBe("over_15m");
		expect(getDurationBucket(3600)).toBe("over_15m");
	});

	it("correctly buckets processing time", () => {
		expect(getProcessingTimeBucket(5)).toBe("under_30s");
		expect(getProcessingTimeBucket(29.9)).toBe("under_30s");
		expect(getProcessingTimeBucket(30)).toBe("30s_to_2m");
		expect(getProcessingTimeBucket(119)).toBe("30s_to_2m");
		expect(getProcessingTimeBucket(120)).toBe("2_to_5m");
		expect(getProcessingTimeBucket(299)).toBe("2_to_5m");
		expect(getProcessingTimeBucket(300)).toBe("over_5m");
		expect(getProcessingTimeBucket(1000)).toBe("over_5m");
	});

	it("normalizes errors to strict allowlist and hides raw messages", () => {
		expect(normalizeErrorCategory(new Error("Failed to fetch"))).toBe(
			"network",
		);
		expect(
			normalizeErrorCategory(
				new Error("NetworkError when attempting to fetch resource"),
			),
		).toBe("network");
		expect(
			normalizeErrorCategory(
				new Error("Permission denied to access microphone"),
			),
		).toBe("permission");
		expect(normalizeErrorCategory(new Error("unsupported video codec"))).toBe(
			"unsupported",
		);
		expect(
			normalizeErrorCategory(new Error("OpenAI rate limit 429 quota exceeded")),
		).toBe("provider");
		expect(
			normalizeErrorCategory(
				new Error("Out of memory on WebCodecs render canvas"),
			),
		).toBe("render");
		expect(
			normalizeErrorCategory(new Error("something completely unexpected")),
		).toBe("unknown");
		expect(normalizeErrorCategory(null)).toBe("unknown");
	});

	it("sanitizes payload and strips sensitive / unexpected properties", () => {
		const payload = {
			format: "mp4",
			quality: "high",
			surface: "desktop",
			placement: "editor_menu",
			// Sensitive / illegal fields that must never pass through:
			transcript: "sensitive user speech",
			projectName: "My Secret Video",
			audioData: new Uint8Array([1, 2, 3]),
			apiKey: "sk-12345",
			email: "user@example.com",
		};

		const sanitized = sanitizePayload(payload as Record<string, unknown>);

		expect(sanitized).toEqual({
			format: "mp4",
			quality: "high",
			surface: "desktop",
			placement: "editor_menu",
		});
		expect((sanitized as Record<string, unknown>).transcript).toBeUndefined();
		expect((sanitized as Record<string, unknown>).projectName).toBeUndefined();
		expect((sanitized as Record<string, unknown>).apiKey).toBeUndefined();
	});

	it("safely handles window being undefined or window.tianji missing", () => {
		const originalWindow = globalThis.window;
		try {
			// @ts-expect-error test environment simulation
			delete globalThis.window;
			expect(() =>
				trackEvent("export_completed", {
					format: "mp4",
					quality: "high",
					surface: "desktop",
					duration_bucket: "1_to_5m",
					processing_time_bucket: "under_30s",
				}),
			).not.toThrow();

			globalThis.window = {} as unknown as Window & typeof globalThis;
			expect(() =>
				trackEvent("export_completed", {
					format: "mp4",
					quality: "high",
					surface: "desktop",
					duration_bucket: "1_to_5m",
					processing_time_bucket: "under_30s",
				}),
			).not.toThrow();
		} finally {
			globalThis.window = originalWindow;
		}
	});

	it("dispatches event to window.tianji when available", () => {
		const originalWindow = globalThis.window;
		try {
			const trackMock = mock(() => {});
			globalThis.window = {
				tianji: { track: trackMock },
			} as unknown as Window & typeof globalThis;

			trackEvent("support_prompt_shown", { surface: "mobile" });
			expect(trackMock).toHaveBeenCalledTimes(1);
			expect(trackMock).toHaveBeenCalledWith("support_prompt_shown", {
				surface: "mobile",
			});

			trackEvent("support_clicked", {
				surface: "desktop",
				placement: "editor_menu",
			});
			expect(trackMock).toHaveBeenCalledTimes(2);
			expect(trackMock).toHaveBeenCalledWith("support_clicked", {
				surface: "desktop",
				placement: "editor_menu",
			});
		} finally {
			globalThis.window = originalWindow;
		}
	});
});
