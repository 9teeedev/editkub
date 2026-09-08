export const DEFAULT_AGENT_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_AGENT_HOSTNAME = "api.openai.com";

export interface EndpointValidationResult {
	isValid: boolean;
	normalizedUrl: string;
	hostname: string;
	isCustom: boolean;
	error?: string;
}

export function isLocalhostHostname(hostname: string): boolean {
	const h = hostname.toLowerCase();
	return (
		h === "localhost" ||
		h === "127.0.0.1" ||
		h === "::1" ||
		h === "[::1]" ||
		h.endsWith(".localhost")
	);
}

/**
 * Validates the Agent base URL according to security constraints:
 * - Empty resolves to default (api.openai.com)
 * - Remote endpoints MUST use HTTPS
 * - HTTP is allowed only for localhost endpoints
 * - Malformed URLs are rejected
 */
export function validateAgentEndpoint(
	rawUrl?: string,
): EndpointValidationResult {
	const trimmed = (rawUrl ?? "").trim();
	if (!trimmed) {
		return {
			isValid: true,
			normalizedUrl: DEFAULT_AGENT_BASE_URL,
			hostname: DEFAULT_AGENT_HOSTNAME,
			isCustom: false,
		};
	}

	try {
		const parsed = new URL(trimmed);
		const protocol = parsed.protocol.toLowerCase();
		const hostname = parsed.hostname.toLowerCase();

		if (protocol === "https:") {
			return {
				isValid: true,
				normalizedUrl: trimmed.replace(/\/+$/, ""),
				hostname: parsed.hostname,
				isCustom: hostname !== DEFAULT_AGENT_HOSTNAME,
			};
		}

		if (protocol === "http:") {
			if (isLocalhostHostname(hostname)) {
				return {
					isValid: true,
					normalizedUrl: trimmed.replace(/\/+$/, ""),
					hostname: parsed.hostname,
					isCustom: true,
				};
			}
			return {
				isValid: false,
				normalizedUrl: trimmed,
				hostname: parsed.hostname,
				isCustom: true,
				error: "Remote endpoints must use HTTPS",
			};
		}

		return {
			isValid: false,
			normalizedUrl: trimmed,
			hostname: parsed.hostname,
			isCustom: true,
			error: "Invalid URL format",
		};
	} catch {
		return {
			isValid: false,
			normalizedUrl: trimmed,
			hostname: "",
			isCustom: true,
			error: "Invalid URL format",
		};
	}
}

export type ConnectionTestState =
	| "testing"
	| "connected"
	| "auth_failed"
	| "model_not_found"
	| "unreachable"
	| "invalid_endpoint"
	| "error";

export interface SanitizedErrorResult {
	state: ConnectionTestState;
	message: string;
}

/**
 * Sanitizes connection test errors.
 * - Never returns raw provider response bodies containing excessive/sensitive info.
 * - Redacts any occurrence of the API key.
 * - Maps to explicit user-facing states.
 */
export function sanitizeConnectionError(
	error: unknown,
	apiKey?: string,
): SanitizedErrorResult {
	let raw = "";
	if (error instanceof Error) {
		raw = error.message;
	} else if (typeof error === "string") {
		raw = error;
	} else {
		raw = "Unknown error occurred";
	}

	if (apiKey && apiKey.trim()) {
		raw = raw.replaceAll(apiKey.trim(), "[REDACTED]");
	}

	const lower = raw.toLowerCase();

	if (
		lower.includes("invalid endpoint") ||
		lower.includes("remote endpoints must use https") ||
		lower.includes("invalid url")
	) {
		return {
			state: "invalid_endpoint",
			message: "Invalid endpoint",
		};
	}

	if (
		lower.includes("401") ||
		lower.includes("403") ||
		lower.includes("unauthorized") ||
		lower.includes("authentication") ||
		lower.includes("incorrect api key") ||
		lower.includes("invalid api key")
	) {
		return {
			state: "auth_failed",
			message: "Authentication failed",
		};
	}

	if (
		lower.includes("404") ||
		lower.includes("model not found") ||
		lower.includes("model_not_found") ||
		lower.includes("no available channel") ||
		lower.includes("does not exist") ||
		lower.includes("unsupported model")
	) {
		return {
			state: "model_not_found",
			message: "Model not found or unsupported",
		};
	}

	if (
		lower.includes("failed to fetch") ||
		lower.includes("networkerror") ||
		lower.includes("econnrefused") ||
		lower.includes("enotfound") ||
		lower.includes("502") ||
		lower.includes("503") ||
		lower.includes("504") ||
		lower.includes("unreachable") ||
		lower.includes("timed out")
	) {
		return {
			state: "unreachable",
			message:
				"Endpoint unreachable — this provider may not allow browser requests",
		};
	}

	return {
		state: "error",
		message: "Connection failed",
	};
}
