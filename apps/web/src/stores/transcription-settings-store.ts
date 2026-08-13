import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TranscriptionSettingsState {
	/** "local" (default, private) | "groq" | "openai" */
	providerId: string;
	/** API key for the selected remote provider (stored in localStorage). */
	apiKey: string;
	/** Selected remote model id. */
	remoteModelId: string;
	// Setters
	setProviderId: (id: string) => void;
	setApiKey: (key: string) => void;
	setRemoteModelId: (id: string) => void;
}

/**
 * Transcription provider settings, persisted to localStorage.
 *
 * Privacy note: API keys are stored client-side in localStorage and sent
 * directly to the provider's API from the browser. They never pass through
 * our own server. Default provider is "local" (in-browser Whisper) to
 * maintain privacy-first behavior.
 */
export const useTranscriptionSettingsStore =
	create<TranscriptionSettingsState>()(
		persist(
			(set) => ({
				providerId: "local",
				apiKey: "",
				remoteModelId: "whisper-large-v3-turbo",
				setProviderId: (providerId) => set({ providerId }),
				setApiKey: (apiKey) => set({ apiKey }),
				setRemoteModelId: (remoteModelId) => set({ remoteModelId }),
			}),
			{ name: "transcription-settings" },
		),
	);
