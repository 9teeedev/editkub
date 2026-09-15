/**
 * UI state for the timeline
 * For core logic, use EditorCore instead.
 */

import { create } from "zustand";
import type { ClipboardItem } from "@/types/timeline";

// Non-secret editor preferences (same localStorage policy as other prefs —
// only secrets use sessionStorage).
const SNAPPING_KEY = "editkub:timeline:snapping";
const RIPPLE_KEY = "editkub:timeline:ripple-editing";

function readBoolFlag(key: string, fallback: boolean): boolean {
	try {
		const raw = localStorage.getItem(key);
		if (raw === null) return fallback;
		return raw === "1";
	} catch {
		return fallback;
	}
}

function writeBoolFlag(key: string, value: boolean): void {
	try {
		localStorage.setItem(key, value ? "1" : "0");
	} catch {
		// ignore storage failures — the toggle still works for this session
	}
}

interface TimelineStore {
	snappingEnabled: boolean;
	toggleSnapping: () => void;
	rippleEditingEnabled: boolean;
	toggleRippleEditing: () => void;
	clipboard: {
		items: ClipboardItem[];
	} | null;
	setClipboard: (
		clipboard: {
			items: ClipboardItem[];
		} | null,
	) => void;
}

export const useTimelineStore = create<TimelineStore>((set) => ({
	snappingEnabled: readBoolFlag(SNAPPING_KEY, true),

	toggleSnapping: () => {
		set((state) => {
			const snappingEnabled = !state.snappingEnabled;
			writeBoolFlag(SNAPPING_KEY, snappingEnabled);
			return { snappingEnabled };
		});
	},

	rippleEditingEnabled: readBoolFlag(RIPPLE_KEY, false),

	toggleRippleEditing: () => {
		set((state) => {
			const rippleEditingEnabled = !state.rippleEditingEnabled;
			writeBoolFlag(RIPPLE_KEY, rippleEditingEnabled);
			return { rippleEditingEnabled };
		});
	},

	clipboard: null,

	setClipboard: (clipboard) => {
		set({ clipboard });
	},
}));
