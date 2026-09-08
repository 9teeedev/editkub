import { create } from "zustand";
import type { TranscriptData } from "@/types/transcript";

interface TranscriptState {
	/** Transcript of the currently open project, or null before first generation. */
	transcript: TranscriptData | null;
	/** Called when a project is loaded/created; replaces the whole transcript. */
	init: (transcript: TranscriptData | null) => void;
	/** Called when a project is closed. */
	clear: () => void;
	/**
	 * Apply a mutation to the transcript. Every mutation should be paired
	 * with a caption-track rebuild so the autosave (driven by timeline
	 * changes) flushes both together.
	 */
	update: (updater: (prev: TranscriptData) => TranscriptData) => void;
}

export const useTranscriptStore = create<TranscriptState>((set) => ({
	transcript: null,
	init: (transcript) => set({ transcript }),
	clear: () => set({ transcript: null }),
	update: (updater) =>
		set((state) => ({
			transcript: state.transcript ? updater(state.transcript) : null,
		})),
}));
