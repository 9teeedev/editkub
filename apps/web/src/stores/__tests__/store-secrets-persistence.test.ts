import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { partializeAgentSettings, useAgentStore } from "../agent-store";
import {
	partializeAISettings,
	useAISettingsStore,
} from "../ai-settings-store";
import { getSessionSecret } from "@/lib/storage/session-secrets";

class MockStorage implements Storage {
	private store = new Map<string, string>();

	getItem(key: string): string | null {
		return this.store.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.store.set(key, String(value));
	}

	removeItem(key: string): void {
		this.store.delete(key);
	}

	clear(): void {
		this.store.clear();
	}

	key(index: number): string | null {
		return Array.from(this.store.keys())[index] ?? null;
	}

	get length(): number {
		return this.store.size;
	}
}

describe("Store secrets persistence and session handling", () => {
	let mockSession: MockStorage;
	let mockLocal: MockStorage;
	const originalWindow = globalThis.window;

	beforeEach(() => {
		mockSession = new MockStorage();
		mockLocal = new MockStorage();

		globalThis.window = {
			sessionStorage: mockSession as unknown as Storage,
			localStorage: mockLocal as unknown as Storage,
		} as unknown as Window & typeof globalThis;
	});

	afterEach(() => {
		globalThis.window = originalWindow;
	});

	test("Agent settings: session storage holds secret and partialize excludes apiKey", () => {
		useAgentStore.getState().setConfig({
			apiKey: "sk-agent-live-test",
			baseUrl: "https://api.openai.com/v1",
			model: "gpt-4o",
		});

		// 1. Secret must be in sessionStorage
		expect(getSessionSecret("agent-api-key")).toBe("sk-agent-live-test");
		expect(mockSession.getItem("editkub:session:agent-api-key")).toBe(
			"sk-agent-live-test",
		);

		// 2. Persisted state must exclude apiKey
		const partialized = partializeAgentSettings(useAgentStore.getState());
		expect((partialized.config as unknown as Record<string, unknown>).apiKey).toBeUndefined();
		expect(partialized.config.baseUrl).toBe("https://api.openai.com/v1");
		expect(partialized.config.model).toBe("gpt-4o");

		// 3. Forgetting / clearing key removes it from session and store
		useAgentStore.getState().forgetApiKey();
		expect(useAgentStore.getState().config.apiKey).toBe("");
		expect(getSessionSecret("agent-api-key")).toBe("");
		expect(mockSession.getItem("editkub:session:agent-api-key")).toBeNull();
	});

	test("AI settings: session storage holds image/video secrets and partialize excludes them", () => {
		const aiStore = useAISettingsStore.getState();
		aiStore.setImageProvider("seedream");
		aiStore.setImageApiKey("sk-image-test-123");
		aiStore.setVideoProvider("seedance");
		aiStore.setVideoApiKey("sk-video-test-456");

		// 1. Secrets must be in sessionStorage
		expect(getSessionSecret("image-api-key")).toBe("sk-image-test-123");
		expect(getSessionSecret("video-api-key")).toBe("sk-video-test-456");
		expect(mockSession.getItem("editkub:session:image-api-key")).toBe(
			"sk-image-test-123",
		);
		expect(mockSession.getItem("editkub:session:video-api-key")).toBe(
			"sk-video-test-456",
		);

		// 2. Persisted state must exclude secrets
		const partialized = partializeAISettings(useAISettingsStore.getState());
		expect((partialized as unknown as Record<string, unknown>).imageApiKey).toBeUndefined();
		expect((partialized as unknown as Record<string, unknown>).videoApiKey).toBeUndefined();
		expect(partialized.imageProviderId).toBe("seedream");
		expect(partialized.videoProviderId).toBe("seedance");

		// 3. Clearing keys removes them from session storage
		useAISettingsStore.getState().clearImageApiKey();
		useAISettingsStore.getState().clearVideoApiKey();

		expect(useAISettingsStore.getState().imageApiKey).toBe("");
		expect(useAISettingsStore.getState().videoApiKey).toBe("");
		expect(getSessionSecret("image-api-key")).toBe("");
		expect(getSessionSecret("video-api-key")).toBe("");
		expect(mockSession.getItem("editkub:session:image-api-key")).toBeNull();
		expect(mockSession.getItem("editkub:session:video-api-key")).toBeNull();
	});
});
