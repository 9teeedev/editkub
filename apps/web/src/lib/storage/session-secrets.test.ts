import { describe, expect, test } from "bun:test";
import {
	clearSessionSecret,
	getSessionSecret,
	setSessionSecret,
} from "./session-secrets";

function createMockStorage(
	initial: Record<string, string> = {},
): Storage {
	const store = new Map<string, string>(Object.entries(initial));
	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => {
			store.set(key, String(value));
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		clear: () => store.clear(),
		key: (index: number) => Array.from(store.keys())[index] ?? null,
		get length() {
			return store.size;
		},
	};
}

describe("session-secrets", () => {
	test("saves and retrieves session secrets", () => {
		const storage = createMockStorage();
		setSessionSecret("agent-api-key", "sk-agent-123", storage);
		expect(getSessionSecret("agent-api-key", storage)).toBe("sk-agent-123");
	});

	test("restores session secret on re-read", () => {
		const storage = createMockStorage({
			"editkub:session:image-api-key": "sk-image-456",
		});
		expect(getSessionSecret("image-api-key", storage)).toBe("sk-image-456");
	});

	test("clearing a key removes the session value", () => {
		const storage = createMockStorage();
		setSessionSecret("video-api-key", "sk-video-789", storage);
		expect(getSessionSecret("video-api-key", storage)).toBe("sk-video-789");

		clearSessionSecret("video-api-key", storage);
		expect(getSessionSecret("video-api-key", storage)).toBe("");
		expect(storage.getItem("editkub:session:video-api-key")).toBeNull();
	});

	test("empty string or whitespace clears session value instead of writing", () => {
		const storage = createMockStorage({
			"editkub:session:agent-api-key": "sk-agent-old",
		});
		setSessionSecret("agent-api-key", "   ", storage);
		expect(getSessionSecret("agent-api-key", storage)).toBe("");
		expect(storage.getItem("editkub:session:agent-api-key")).toBeNull();
	});
});
