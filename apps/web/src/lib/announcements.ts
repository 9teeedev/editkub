import type { Tab } from "@/stores/assets-panel-store";

export type AnnouncementTag = "new" | "improved" | "fixed";

export interface AnnouncementCta {
	/** i18n source string — translated at render time. */
	label: string;
	/** Opens an assets-panel tab (e.g. "captions") inside the editor. */
	panel?: Tab;
	/** Internal link (locale-aware). */
	href?: string;
}

export interface Announcement {
	id: string;
	tag: AnnouncementTag;
	/** ISO date (YYYY-MM-DD) shown in the list. */
	date: string;
	/** i18n source string — translated at render time. */
	title: string;
	/** i18n source string — translated at render time. */
	description: string;
	cta?: AnnouncementCta;
}

/**
 * In-product news list, newest first. Add an entry in the same PR as the
 * feature it announces — it goes live with the deploy. Old entries fall off
 * the popover (only the newest few are shown); prune the list occasionally.
 */
export const ANNOUNCEMENTS: Announcement[] = [
	{
		id: "2026-09-08-agent-providers",
		tag: "new",
		date: "2026-09-08",
		title: "More AI providers for the agent",
		description:
			"Choose OpenAI or Anthropic API format, pick a model from your provider's list, and use providers that block browser requests (z.ai, TokenRouter) via the server relay.",
	},
	{
		id: "2026-08-31-adjustment-layers",
		tag: "new",
		date: "2026-08-31",
		title: "Adjustment layers",
		description:
			"Apply color adjustments to every clip below a layer, with a dedicated timeline span.",
		cta: { label: "Try it", panel: "effects" },
	},
	{
		id: "2026-08-31-karaoke-captions",
		tag: "new",
		date: "2026-08-31",
		title: "Karaoke captions",
		description:
			"Word-synced captions from your transcript, with templates and a Style tab.",
		cta: { label: "Try it", panel: "captions" },
	},
	{
		id: "2026-08-30-srt-import-export",
		tag: "new",
		date: "2026-08-30",
		title: "SRT import & export",
		description: "Import SRT files as captions or export your transcript as SRT.",
	},
	{
		id: "2026-08-26-mobile-timeline-editing",
		tag: "new",
		date: "2026-08-26",
		title: "Crop & mobile timeline editing",
		description: "Cut-away crop plus split and trim tools on mobile.",
	},
];

const STORAGE_KEY = "editkub:seen-announcements";
const MAX_SHOWN = 5;

export function getRecentAnnouncements(): Announcement[] {
	return ANNOUNCEMENTS.slice(0, MAX_SHOWN);
}

export function readSeenAnnouncementIds(): string[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed)
			? parsed.filter((value): value is string => typeof value === "string")
			: [];
	} catch {
		return [];
	}
}

export function writeSeenAnnouncementIds(ids: string[]): void {
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
	} catch {
		// storage unavailable (private mode) — unread state just won't persist
	}
}
