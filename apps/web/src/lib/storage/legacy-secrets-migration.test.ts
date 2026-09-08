import { describe, expect, test } from "bun:test";
import { migrateLegacySecrets } from "./legacy-secrets-migration";

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

describe("legacy-secrets-migration", () => {
	test("removes persisted apiKey from agent-settings while preserving non-secret settings", () => {
		const agentState = {
			state: {
				config: {
					baseUrl: "https://api.openai.com/v1",
					apiKey: "sk-legacy-secret-123",
					model: "gpt-4o",
				},
				autoMode: true,
				isOpen: false,
				expertRole: "director",
				contextWindow: 128000,
				modelList: [{ id: "gpt-4o" }],
			},
			version: 0,
		};

		const storage = createMockStorage({
			"agent-settings": JSON.stringify(agentState),
			"unrelated-key": "preserve-me",
		});

		const result = migrateLegacySecrets(storage);
		expect(result.migratedAgent).toBe(true);

		const updated = JSON.parse(storage.getItem("agent-settings") ?? "{}");
		expect(updated.state.config.apiKey).toBeUndefined();
		expect(updated.state.config.baseUrl).toBe("https://api.openai.com/v1");
		expect(updated.state.config.model).toBe("gpt-4o");
		expect(updated.state.autoMode).toBe(true);
		expect(updated.state.expertRole).toBe("director");
		expect(updated.state.modelList).toEqual([{ id: "gpt-4o" }]);

		// Preserves unrelated keys
		expect(storage.getItem("unrelated-key")).toBe("preserve-me");
	});

	test("removes persisted imageApiKey and videoApiKey from ai-settings while preserving non-secret settings", () => {
		const aiState = {
			state: {
				imageProviderId: "seedream",
				imageApiKey: "sk-legacy-image-key",
				videoProviderId: "seedance",
				videoApiKey: "sk-legacy-video-key",
				devPlaceholderEnabled: false,
			},
			version: 0,
		};

		const storage = createMockStorage({
			"ai-settings": JSON.stringify(aiState),
		});

		const result = migrateLegacySecrets(storage);
		expect(result.migratedAi).toBe(true);

		const updated = JSON.parse(storage.getItem("ai-settings") ?? "{}");
		expect(updated.state.imageApiKey).toBeUndefined();
		expect(updated.state.videoApiKey).toBeUndefined();
		expect(updated.state.imageProviderId).toBe("seedream");
		expect(updated.state.videoProviderId).toBe("seedance");
		expect(updated.state.devPlaceholderEnabled).toBe(false);
	});

	test("migration is idempotent", () => {
		const agentState = {
			state: {
				config: {
					baseUrl: "https://api.openai.com/v1",
					apiKey: "sk-legacy-secret-123",
					model: "gpt-4o",
				},
				autoMode: true,
			},
			version: 0,
		};

		const storage = createMockStorage({
			"agent-settings": JSON.stringify(agentState),
		});

		const run1 = migrateLegacySecrets(storage);
		expect(run1.migratedAgent).toBe(true);

		const run2 = migrateLegacySecrets(storage);
		expect(run2.migratedAgent).toBe(false);
		expect(run2.migratedAi).toBe(false);

		const finalState = JSON.parse(storage.getItem("agent-settings") ?? "{}");
		expect(finalState.state.config.apiKey).toBeUndefined();
		expect(finalState.state.config.model).toBe("gpt-4o");
	});
});
