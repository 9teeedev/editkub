/**
 * Helpers for post-export donation prompt and rolling 7-day cooldown.
 */

import { toast } from "sonner";
import { trackEvent } from "./analytics";

export const SUPPORT_PROMPT_STORAGE_KEY = "editkub:support-prompt-last-shown";
export const SUPPORT_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const DONATION_URL = "https://buymeacoffee.com/9teeedev";

/**
 * Checks whether the post-export support prompt is allowed to show.
 * - Max once per rolling 7-day window on the same browser.
 * - Fails closed (returns false) if localStorage throws or is unavailable,
 *   preventing repeated prompts in private browsing or constrained environments.
 */
export function shouldShowSupportPrompt(now: number = Date.now()): boolean {
	if (typeof window === "undefined") return false;

	try {
		const raw = window.localStorage.getItem(SUPPORT_PROMPT_STORAGE_KEY);
		if (!raw) return true;

		const lastShown = Number.parseInt(raw, 10);
		if (!Number.isFinite(lastShown) || lastShown <= 0) return true;

		return now - lastShown >= SUPPORT_PROMPT_COOLDOWN_MS;
	} catch {
		// If storage is unavailable/restricted, fail silently and avoid prompting repeatedly
		return false;
	}
}

/**
 * Persists the current timestamp to local storage.
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
				trackEvent("support_clicked", { surface });
				if (typeof window !== "undefined") {
					window.open(DONATION_URL, "_blank", "noopener,noreferrer");
				}
			},
		},
		duration: 10000,
		dismissible: true,
	});
}
