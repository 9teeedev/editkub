import { create } from "zustand";

/**
 * Voiceover recording UI state. Drives the preview overlay (countdown +
 * recording indicator) and coordinates between the timeline toolbar button
 * and the recording hook.
 *
 * The flow is:
 *   idle → countdown (3·2·1) → recording → idle
 *
 * The hook itself (`useVoiceRecording`) owns the MediaRecorder + file output.
 * This store only tracks the UI phase so the toolbar button, overlay, and
 * hook can stay decoupled.
 */
export type VoiceoverMode = "idle" | "countdown" | "recording";

interface VoiceoverState {
	/** Current phase of the voiceover flow. */
	mode: VoiceoverMode;
	/** Countdown value shown during the "countdown" phase (3 → 2 → 1). */
	countdown: number | null;
	/**
	 * Timeline position (seconds) where recording should start — captured
	 * from the playhead when the user arms recording.
	 */
	startTime: number;
	/** Whether the project's original audio should play through the speakers while recording. */
	monitorOriginalAudio: boolean;

	startCountdown: (startTime: number) => void;
	beginRecording: () => void;
	stop: () => void;
	reset: () => void;
	setStartTime: (time: number) => void;
	toggleMonitorAudio: () => void;
	setMonitorAudio: (value: boolean) => void;
}

const COUNTDOWN_FROM = 3;

export const useVoiceoverStore = create<VoiceoverState>((set) => ({
	mode: "idle",
	countdown: null,
	startTime: 0,
	monitorOriginalAudio: true,

	startCountdown: (startTime) =>
		set({
			mode: "countdown",
			countdown: COUNTDOWN_FROM,
			startTime,
		}),

	beginRecording: () => set({ mode: "recording", countdown: null }),

	stop: () => set({ mode: "idle", countdown: null }),

	reset: () => set({ mode: "idle", countdown: null, startTime: 0 }),

	setStartTime: (time) => set({ startTime: time }),

	toggleMonitorAudio: () =>
		set((state) => ({ monitorOriginalAudio: !state.monitorOriginalAudio })),

	setMonitorAudio: (value) => set({ monitorOriginalAudio: value }),
}));
