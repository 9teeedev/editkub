import { isLocalhostHostname } from "./endpoint-validation";

/**
 * Server relay for LLM providers that block cross-origin browser requests
 * (z.ai, TokenRouter, ...). The client sends the request to a same-origin
 * Next.js route which forwards it to the real provider, so the browser never
 * makes a cross-origin call the provider would 403.
 */

export const AGENT_RELAY_ENDPOINT = "/api/agent/relay";
export const RELAY_TARGET_HEADER = "x-relay-target";

/** Request headers the relay is allowed to forward upstream. */
export const RELAY_FORWARDABLE_HEADERS = [
	"authorization",
	"x-api-key",
	"anthropic-version",
	"anthropic-dangerous-direct-browser-access",
	"content-type",
] as const;

/**
 * Maps a direct provider URL to the actual fetch target: either unchanged
 * (direct mode) or the same-origin relay endpoint with the real URL carried
 * in a header (relay mode).
 */
export function resolveAgentRequest(
	relay: boolean | undefined,
	targetUrl: string,
): { url: string; headers: Record<string, string> } {
	if (!relay) {
		return { url: targetUrl, headers: {} };
	}
	return {
		url: AGENT_RELAY_ENDPOINT,
		headers: { [RELAY_TARGET_HEADER]: targetUrl },
	};
}

// Private IPv4 literals — never valid relay targets (SSRF / cloud metadata).
const PRIVATE_IPV4_PATTERNS = [
	/^0\./,
	/^10\./,
	/^169\.254\./,
	/^172\.(1[6-9]|2\d|3[01])\./,
	/^192\.168\./,
];

/**
 * Guards the relay against SSRF: https targets only, http only for localhost
 * (local LLM backends), and no private/link-local IP literals.
 */
export function isRelayTargetAllowed(rawUrl: string): boolean {
	let parsed: URL;
	try {
		parsed = new URL(rawUrl);
	} catch {
		return false;
	}

	const hostname = parsed.hostname.toLowerCase();
	if (hostname.startsWith("[")) {
		return hostname === "[::1]" && parsed.protocol === "http:";
	}
	if (PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(hostname))) {
		return false;
	}
	if (isLocalhostHostname(hostname)) {
		return parsed.protocol === "http:";
	}
	return parsed.protocol === "https:";
}
