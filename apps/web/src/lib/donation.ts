/**
 * Helpers for post-export donation prompt and rolling 7-day cooldown.
 */

import { toast } from "sonner";
import { trackEvent } from "./analytics";

export const SUPPORT_PROMPT_STORAGE_KEY = "editkub:support-prompt-last-shown";
export const SUPPORT_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const SUPPORT_CLICKED_STORAGE_KEY = "editkub:support-clicked-last-shown";
export const SUPPORT_CLICKED_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const DONATION_URL = "https://buymeacoffee.com/9teeedev";

export interface RecordSupportClickOptions {
	surface?: "desktop" | "mobile";
	placement: "post_export" | "editor_menu" | "footer";
	openWindow?: boolean;
	now?: number;
}

/**
 * Checks whether the post-export support prompt is allowed to show.
 * - Max once per rolling 7-day window on the same browser.
 * - Suppressed for 30 days if user previously clicked any support entry point.
 * - Fails closed (returns false) if localStorage throws or is unavailable,
 *   preventing repeated prompts in private browsing or constrained environments.
 */
export function shouldShowSupportPrompt(now: number = Date.now()): boolean {
	if (typeof window === "undefined") return false;

	try {
		const rawClicked = window.localStorage.getItem(SUPPORT_CLICKED_STORAGE_KEY);
		if (rawClicked) {
			const lastClicked = Number.parseInt(rawClicked, 10);
			if (
				Number.isFinite(lastClicked) &&
				lastClicked > 0 &&
				now - lastClicked < SUPPORT_CLICKED_COOLDOWN_MS
			) {
				return false;
			}
		}

		const rawShown = window.localStorage.getItem(SUPPORT_PROMPT_STORAGE_KEY);
		if (!rawShown) return true;

		const lastShown = Number.parseInt(rawShown, 10);
		if (!Number.isFinite(lastShown) || lastShown <= 0) return true;

		return now - lastShown >= SUPPORT_PROMPT_COOLDOWN_MS;
	} catch {
		// If storage is unavailable/restricted, fail silently and avoid prompting repeatedly
		return false;
	}
}

/**
 * Persists the prompt shown timestamp to local storage.
 */
export function recordSupportPromptShown(now: number = Date.now()): void {
	if (typeof window === "undefined") return;

	try {
		window.localStorage.setItem(SUPPORT_PROMPT_STORAGE_KEY, String(now));
	} catch {
		// Fail silently if storage is blocked
	}
}

/**
 * Records user support intent, sets the 30-day cooldown timestamp,
 * dispatches analytics event, and safely opens the donation link in a new tab.
 * Fail-safe: storage/telemetry errors never block opening the donation link.
 */
export function recordSupportClick({
	surface,
	placement,
	openWindow = true,
	now = Date.now(),
}: RecordSupportClickOptions): void {
	try {
		if (typeof window !== "undefined") {
			window.localStorage.setItem(SUPPORT_CLICKED_STORAGE_KEY, String(now));
		}
	} catch {
		// Fail silently if storage is blocked
	}

	try {
		trackEvent("support_clicked", { surface, placement });
	} catch {
		// Fire-and-forget analytics
	}

	if (
		openWindow &&
		typeof window !== "undefined" &&
		typeof window.open === "function"
	) {
		try {
			window.open(DONATION_URL, "_blank", "noopener,noreferrer");
		} catch {
			// Fail-safe if window.open fails
		}
	}
}

/**
 * Triggers the non-modal post-export notification.
 * If within cooldown, shows a quiet success toast without donation prompt.
 * If cooldown has passed, shows a compact donation prompt toast.
 */
export function triggerPostExportNotification({
	surface,
	t,
}: {
	surface: "desktop" | "mobile";
	t: (key: string) => string;
}): void {
	const canShow = shouldShowSupportPrompt();

	if (!canShow) {
		toast.success(t("Export complete"));
		return;
	}

	recordSupportPromptShown();
	trackEvent("support_prompt_shown", { surface });

	toast.success(t("Export complete"), {
		description: t(
			"Editkub is free and built independently. If it helped, you can support its development.",
		),
		action: {
			label: t("Support Editkub"),
			onClick: () => {
				recordSupportClick({ surface, placement: "post_export" });
			},
		},
		duration: 10000,
		dismissible: true,
	});
}
