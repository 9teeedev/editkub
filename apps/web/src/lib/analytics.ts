/**
 * Privacy-safe analytics helper.
 * Wraps Tianji tracker (`window.tianji?.track`).
 *
 * FIRE-AND-FORGET:
 * Never throws, never breaks exports, captions, downloads, or UI flows.
 *
 * NEVER COLLECTS:
 * - Media, audio, video, images, or file blobs
 * - Filenames, project names, or generated project/media IDs
 * - Transcripts, captions, prompts, or search text
 * - Media URLs, API keys, tokens, or headers
 * - Emails or feedback text
 */

export type DurationBucket = "under_1m" | "1_to_5m" | "5_to_15m" | "over_15m";

export type ProcessingTimeBucket =
	| "under_30s"
	| "30s_to_2m"
	| "2_to_5m"
	| "over_5m";

export type ErrorCategory =
	| "network"
	| "unsupported"
	| "provider"
	| "render"
	| "permission"
	| "unknown";

export type CaptionFeedbackCategory = "good" | "words" | "timing" | "slow";

export interface AnalyticsEventMap {
	export_completed: {
		format: "mp4" | "webm";
		quality: "low" | "medium" | "high" | "very_high";
		surface: "desktop" | "mobile";
		duration_bucket: DurationBucket;
		processing_time_bucket: ProcessingTimeBucket;
	};
	export_failed: {
		format: "mp4" | "webm";
		quality: "low" | "medium" | "high" | "very_high";
		surface: "desktop" | "mobile";
		duration_bucket: DurationBucket;
		processing_time_bucket: ProcessingTimeBucket;
		error_category: ErrorCategory;
	};
	export_cancelled: {
		format: "mp4" | "webm";
		quality: "low" | "medium" | "high" | "very_high";
		surface: "desktop" | "mobile";
		duration_bucket: DurationBucket;
	};
	caption_completed: {
		mode: "local" | "remote";
		provider: string;
		duration_bucket: DurationBucket;
		processing_time_bucket: ProcessingTimeBucket;
	};
	caption_failed: {
		mode: "local" | "remote";
		provider: string;
		duration_bucket: DurationBucket;
		processing_time_bucket: ProcessingTimeBucket;
		error_category: ErrorCategory;
	};
	caption_cancelled: {
		mode: "local" | "remote";
		provider: string;
		duration_bucket: DurationBucket;
	};
	caption_feedback: {
		category: CaptionFeedbackCategory;
		mode: "local" | "remote";
		provider: string;
	};
	support_prompt_shown: {
		surface: "desktop" | "mobile";
	};
	support_clicked: {
		surface: "desktop" | "mobile";
	};
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

declare global {
	interface Window {
		tianji?: {
			track?: (eventName: string, eventData?: Record<string, unknown>) => void;
		};
	}
}

/**
 * Coarse duration bucket for media/audio.
 */
export function getDurationBucket(seconds: number): DurationBucket {
	if (!Number.isFinite(seconds) || seconds < 60) return "under_1m";
	if (seconds < 300) return "1_to_5m";
	if (seconds < 900) return "5_to_15m";
	return "over_15m";
}

/**
 * Coarse processing-time bucket for render or AI operations.
 */
export function getProcessingTimeBucket(seconds: number): ProcessingTimeBucket {
	if (!Number.isFinite(seconds) || seconds < 30) return "under_30s";
	if (seconds < 120) return "30s_to_2m";
	if (seconds < 300) return "2_to_5m";
	return "over_5m";
}

/**
 * Normalizes raw exceptions/error codes into a strict allowlisted category.
 * Never leaks raw exception messages.
 */
export function normalizeErrorCategory(error: unknown): ErrorCategory {
	if (!error) return "unknown";

	const str =
		typeof error === "string"
			? error.toLowerCase()
			: error instanceof Error
				? `${error.name} ${error.message}`.toLowerCase()
				: typeof error === "object" && error !== null && "code" in error
					? String((error as { code: unknown }).code).toLowerCase()
					: "";

	if (!str) return "unknown";

	if (
		str.includes("permission") ||
		str.includes("notallowederror") ||
		str.includes("securityerror") ||
		str.includes("denied")
	) {
		return "permission";
	}

	if (
		str.includes("network") ||
		str.includes("fetch") ||
		str.includes("offline") ||
		str.includes("timeout") ||
		str.includes("econnrefused") ||
		str.includes("load failed")
	) {
		return "network";
	}

	if (
		str.includes("quota") ||
		str.includes("rate limit") ||
		str.includes("401") ||
		str.includes("403") ||
		str.includes("api key") ||
		str.includes("provider") ||
		str.includes("unauthorized")
	) {
		return "provider";
	}

	if (
		str.includes("render") ||
		str.includes("canvas") ||
		str.includes("webcodecs") ||
		str.includes("audiobuffer") ||
		str.includes("webgl") ||
		str.includes("memory") ||
		str.includes("oom")
	) {
		return "render";
	}

	if (
		str.includes("unsupported") ||
		str.includes("codec") ||
		str.includes("notsupported") ||
		str.includes("format")
	) {
		return "unsupported";
	}

	return "unknown";
}

const ALLOWED_PROPERTIES = new Set([
	"format",
	"quality",
	"surface",
	"mode",
	"provider",
	"duration_bucket",
	"processing_time_bucket",
	"error_category",
	"category",
]);

/**
 * Sanitizes payload so only explicitly allowed property keys pass through.
 */
export function sanitizePayload<T extends Record<string, unknown>>(
	payload?: T,
): Record<string, unknown> | undefined {
	if (!payload) return undefined;
	const sanitized: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(payload)) {
		if (ALLOWED_PROPERTIES.has(key) && value !== undefined) {
			sanitized[key] = value;
		}
	}
	return sanitized;
}

/**
 * Dispatches an event to Tianji tracker safely.
 */
export function trackEvent<K extends AnalyticsEventName>(
	eventName: K,
	properties?: AnalyticsEventMap[K],
): void {
	try {
		if (typeof window === "undefined") return;

		const payload = sanitizePayload(properties as Record<string, unknown>);

		if (typeof window.tianji?.track === "function") {
			window.tianji.track(eventName, payload);
		}
	} catch (err) {
		// Fire-and-forget: analytics must never throw or disrupt user operations
		if (process.env.NODE_ENV === "development") {
			console.warn("[analytics] Failed to track event:", eventName, err);
		}
	}
}
