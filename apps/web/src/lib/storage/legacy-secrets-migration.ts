/**
 * Narrowly scoped migration to remove persisted API keys from localStorage
 * while preserving all non-secret user preferences.
 * Does not transfer legacy keys into session storage.
 */
export function migrateLegacySecrets(storage?: Storage): {
	migratedAgent: boolean;
	migratedAi: boolean;
} {
	const result = { migratedAgent: false, migratedAi: false };
	let s: Storage | null = null;
	if (storage) {
		s = storage;
	} else if (typeof window !== "undefined") {
		try {
			s = window.localStorage;
		} catch {
			s = null;
		}
	}
	if (!s) return result;

	// 1. Clean agent-settings in localStorage
	try {
		const rawAgent = s.getItem("agent-settings");
		if (rawAgent) {
			const parsed = JSON.parse(rawAgent);
			if (
				parsed &&
				typeof parsed === "object" &&
				parsed.state &&
				typeof parsed.state === "object" &&
				parsed.state.config &&
				typeof parsed.state.config === "object" &&
				"apiKey" in parsed.state.config
			) {
				delete parsed.state.config.apiKey;
				s.setItem("agent-settings", JSON.stringify(parsed));
				result.migratedAgent = true;
			}
		}
	} catch {
		// Ignore parse / storage errors safely
	}

	// 2. Clean ai-settings in localStorage
	try {
		const rawAi = s.getItem("ai-settings");
		if (rawAi) {
			const parsed = JSON.parse(rawAi);
			if (
				parsed &&
				typeof parsed === "object" &&
				parsed.state &&
				typeof parsed.state === "object"
			) {
				let modified = false;
				if ("imageApiKey" in parsed.state) {
					delete parsed.state.imageApiKey;
					modified = true;
				}
				if ("videoApiKey" in parsed.state) {
					delete parsed.state.videoApiKey;
					modified = true;
				}
				if (modified) {
					s.setItem("ai-settings", JSON.stringify(parsed));
					result.migratedAi = true;
				}
			}
		}
	} catch {
		// Ignore parse / storage errors safely
	}

	return result;
}
