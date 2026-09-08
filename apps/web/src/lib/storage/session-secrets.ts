export type SessionSecretKey =
	| "agent-api-key"
	| "image-api-key"
	| "video-api-key";

export const SESSION_STORAGE_KEYS: Record<SessionSecretKey, string> = {
	"agent-api-key": "editkub:session:agent-api-key",
	"image-api-key": "editkub:session:image-api-key",
	"video-api-key": "editkub:session:video-api-key",
};

function getStorage(storage?: Storage): Storage | null {
	if (storage) return storage;
	if (typeof window === "undefined") return null;
	try {
		return window.sessionStorage;
	} catch {
		return null;
	}
}

/**
 * Retrieves a session-only secret. Returns empty string if not found, on SSR,
 * or if storage access is restricted.
 */
export function getSessionSecret(
	key: SessionSecretKey,
	storage?: Storage,
): string {
	try {
		const s = getStorage(storage);
		if (!s) return "";
		return s.getItem(SESSION_STORAGE_KEYS[key]) ?? "";
	} catch {
		return "";
	}
}

/**
 * Stores a secret in sessionStorage. Empty or whitespace-only keys are cleared
 * instead of stored.
 */
export function setSessionSecret(
	key: SessionSecretKey,
	value: string,
	storage?: Storage,
): void {
	try {
		const s = getStorage(storage);
		if (!s) return;
		const storageKey = SESSION_STORAGE_KEYS[key];
		const trimmed = value.trim();
		if (!trimmed) {
			s.removeItem(storageKey);
		} else {
			s.setItem(storageKey, trimmed);
		}
	} catch {
		// Ignore storage write errors (e.g. quota/sandboxed iframe)
	}
}

/**
 * Immediately clears a session secret from sessionStorage.
 */
export function clearSessionSecret(
	key: SessionSecretKey,
	storage?: Storage,
): void {
	try {
		const s = getStorage(storage);
		if (!s) return;
		s.removeItem(SESSION_STORAGE_KEYS[key]);
	} catch {
		// Ignore storage errors
	}
}
