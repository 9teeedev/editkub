import { describe, it, expect, beforeEach } from "bun:test";
import {
	shouldShowSupportPrompt,
	recordSupportPromptShown,
	SUPPORT_PROMPT_STORAGE_KEY,
	SUPPORT_PROMPT_COOLDOWN_MS,
} from "./donation";

class MockLocalStorage {
	private store = new Map<string, string>();
	get length(): number {
		return this.store.size;
	}
	key(index: number): string | null {
		return Array.from(this.store.keys())[index] ?? null;
	}
	getItem(key: string): string | null {
		return this.store.get(key) ?? null;
	}
	setItem(key: string, value: string): void {
		this.store.set(key, value);
	}
	removeItem(key: string): void {
		this.store.delete(key);
	}
	clear(): void {
		this.store.clear();
	}
}

describe("Support Prompt 30-day Cooldown", () => {
	let mockStorage: MockLocalStorage;

	beforeEach(() => {
		mockStorage = new MockLocalStorage();
		globalThis.window = {
			localStorage: mockStorage as unknown as Storage,
		} as unknown as Window & typeof globalThis;
	});

	it("allows showing prompt when never shown before", () => {
		expect(shouldShowSupportPrompt()).toBe(true);
	});

	it("suppresses prompt within rolling 7-day cooldown period", () => {
		const now = Date.now();
		recordSupportPromptShown(now);

		// 1 minute later
		expect(shouldShowSupportPrompt(now + 60 * 1000)).toBe(false);

		// 6 days later
		expect(
			shouldShowSupportPrompt(now + 6 * 24 * 60 * 60 * 1000),
		).toBe(false);
	});

	it("allows showing prompt again after 7 days have elapsed", () => {
		const now = Date.now();
		recordSupportPromptShown(now);

		// Exactly 7 days
		expect(
			shouldShowSupportPrompt(now + SUPPORT_PROMPT_COOLDOWN_MS),
		).toBe(true);

		// 8 days later
		expect(
			shouldShowSupportPrompt(now + 8 * 24 * 60 * 60 * 1000),
		).toBe(true);
	});

	it("fails closed silently if localStorage throws or is restricted", () => {
		const originalGetItem = window.localStorage.getItem;
		window.localStorage.getItem = () => {
			throw new DOMException("QuotaExceededError or private browsing blocked");
		};

		try {
			expect(shouldShowSupportPrompt()).toBe(false);
		} finally {
			window.localStorage.getItem = originalGetItem;
		}
	});
});
