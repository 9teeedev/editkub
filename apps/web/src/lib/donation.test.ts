import { describe, it, expect, beforeEach, mock } from "bun:test";
import {
	shouldShowSupportPrompt,
	recordSupportPromptShown,
	recordSupportClick,
	SUPPORT_PROMPT_STORAGE_KEY,
	SUPPORT_PROMPT_COOLDOWN_MS,
	SUPPORT_CLICKED_STORAGE_KEY,
	SUPPORT_CLICKED_COOLDOWN_MS,
	DONATION_URL,
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

describe("Support Prompt Dual Cooldown (7-day prompt / 30-day click)", () => {
	let mockStorage: MockLocalStorage;
	let openMock: ReturnType<typeof mock>;
	let trackMock: ReturnType<typeof mock>;

	beforeEach(() => {
		mockStorage = new MockLocalStorage();
		openMock = mock(() => null);
		trackMock = mock(() => {});

		globalThis.window = {
			localStorage: mockStorage as unknown as Storage,
			open: openMock,
			tianji: { track: trackMock },
		} as unknown as Window & typeof globalThis;
	});

	it("allows showing prompt when never shown and never clicked", () => {
		expect(shouldShowSupportPrompt()).toBe(true);
	});

	it("suppresses prompt within rolling 7-day cooldown of prompt shown", () => {
		const now = Date.now();
		recordSupportPromptShown(now);

		// 1 minute later
		expect(shouldShowSupportPrompt(now + 60 * 1000)).toBe(false);

		// 6 days later
		expect(shouldShowSupportPrompt(now + 6 * 24 * 60 * 60 * 1000)).toBe(false);
	});

	it("allows showing prompt again after 7 days have elapsed since prompt", () => {
		const now = Date.now();
		recordSupportPromptShown(now);

		// Exactly 7 days
		expect(shouldShowSupportPrompt(now + SUPPORT_PROMPT_COOLDOWN_MS)).toBe(
			true,
		);

		// 8 days later
		expect(shouldShowSupportPrompt(now + 8 * 24 * 60 * 60 * 1000)).toBe(true);
	});

	it("suppresses prompt within rolling 30-day cooldown after support click", () => {
		const now = Date.now();
		recordSupportClick({ placement: "footer", now, openWindow: false });

		// 1 hour later
		expect(shouldShowSupportPrompt(now + 60 * 60 * 1000)).toBe(false);

		// 29 days later
		expect(shouldShowSupportPrompt(now + 29 * 24 * 60 * 60 * 1000)).toBe(false);
	});

	it("allows showing prompt after 30 days have elapsed since support click", () => {
		const now = Date.now();
		recordSupportClick({ placement: "editor_menu", now, openWindow: false });

		// Exactly 30 days
		expect(shouldShowSupportPrompt(now + SUPPORT_CLICKED_COOLDOWN_MS)).toBe(
			true,
		);

		// 31 days later
		expect(shouldShowSupportPrompt(now + 31 * 24 * 60 * 60 * 1000)).toBe(true);
	});

	it("respects whichever cooldown is still active in dual cooldown interactions", () => {
		const now = Date.now();
		// Prompt shown 8 days ago (passed 7d), but clicked 10 days ago (within 30d)
		mockStorage.setItem(
			SUPPORT_PROMPT_STORAGE_KEY,
			String(now - 8 * 24 * 60 * 60 * 1000),
		);
		mockStorage.setItem(
			SUPPORT_CLICKED_STORAGE_KEY,
			String(now - 10 * 24 * 60 * 60 * 1000),
		);
		expect(shouldShowSupportPrompt(now)).toBe(false);

		// Clicked 35 days ago (passed 30d), but prompt shown 3 days ago (within 7d)
		mockStorage.setItem(
			SUPPORT_PROMPT_STORAGE_KEY,
			String(now - 3 * 24 * 60 * 60 * 1000),
		);
		mockStorage.setItem(
			SUPPORT_CLICKED_STORAGE_KEY,
			String(now - 35 * 24 * 60 * 60 * 1000),
		);
		expect(shouldShowSupportPrompt(now)).toBe(false);

		// Both passed (prompt shown 8 days ago, clicked 35 days ago)
		mockStorage.setItem(
			SUPPORT_PROMPT_STORAGE_KEY,
			String(now - 8 * 24 * 60 * 60 * 1000),
		);
		expect(shouldShowSupportPrompt(now)).toBe(true);
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

	it("recordSupportClick records timestamp, tracks event, and opens donation window", () => {
		const now = 1700000000000;
		recordSupportClick({
			surface: "desktop",
			placement: "editor_menu",
			now,
		});

		expect(mockStorage.getItem(SUPPORT_CLICKED_STORAGE_KEY)).toBe(String(now));
		expect(trackMock).toHaveBeenCalledTimes(1);
		expect(trackMock).toHaveBeenCalledWith("support_clicked", {
			surface: "desktop",
			placement: "editor_menu",
		});
		expect(openMock).toHaveBeenCalledTimes(1);
		expect(openMock).toHaveBeenCalledWith(
			DONATION_URL,
			"_blank",
			"noopener,noreferrer",
		);
	});

	it("recordSupportClick suppresses window.open when openWindow is false", () => {
		recordSupportClick({
			placement: "footer",
			openWindow: false,
		});

		expect(mockStorage.getItem(SUPPORT_CLICKED_STORAGE_KEY)).not.toBeNull();
		expect(trackMock).toHaveBeenCalledTimes(1);
		expect(trackMock).toHaveBeenCalledWith("support_clicked", {
			placement: "footer",
		});
		expect(openMock).not.toHaveBeenCalled();
	});

	it("recordSupportClick never throws if localStorage or open throws", () => {
		window.localStorage.setItem = () => {
			throw new Error("Quota exceeded");
		};
		window.open = () => {
			throw new Error("Popup blocked");
		};

		expect(() => {
			recordSupportClick({
				surface: "mobile",
				placement: "editor_menu",
			});
		}).not.toThrow();
	});
});
