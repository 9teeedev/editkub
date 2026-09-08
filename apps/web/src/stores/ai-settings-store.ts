import { IS_DEV } from "@/constants/editor-constants";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
	clearSessionSecret,
	getSessionSecret,
	setSessionSecret,
} from "@/lib/storage/session-secrets";
import { migrateLegacySecrets } from "@/lib/storage/legacy-secrets-migration";

// Run legacy localStorage secret migration safely on startup
migrateLegacySecrets();

interface AISettingsPersistedState {
	imageProviderId: string | null;
	videoProviderId: string | null;
	devPlaceholderEnabled: boolean;
}

interface AISettingsState extends AISettingsPersistedState {
	imageApiKey: string;
	videoApiKey: string;

	setImageProvider: (providerId: string | null) => void;
	setImageApiKey: (apiKey: string) => void;
	clearImageApiKey: () => void;
	setVideoProvider: (providerId: string | null) => void;
	setVideoApiKey: (apiKey: string) => void;
	clearVideoApiKey: () => void;
	setDevPlaceholderEnabled: (enabled: boolean) => void;
}

export const partializeAISettings = (
	state: AISettingsState,
): AISettingsPersistedState => ({
	imageProviderId: state.imageProviderId,
	videoProviderId: state.videoProviderId,
	devPlaceholderEnabled: state.devPlaceholderEnabled,
});

export const useAISettingsStore = create<AISettingsState>()(
	persist(
		(set) => ({
			imageProviderId: null,
			imageApiKey: getSessionSecret("image-api-key"),
			videoProviderId: null,
			videoApiKey: getSessionSecret("video-api-key"),
			devPlaceholderEnabled: IS_DEV,

			setImageProvider: (providerId) => set({ imageProviderId: providerId }),
			setImageApiKey: (apiKey) => {
				const trimmed = apiKey.trim();
				if (trimmed) {
					setSessionSecret("image-api-key", trimmed);
				} else {
					clearSessionSecret("image-api-key");
				}
				set({ imageApiKey: apiKey });
			},
			clearImageApiKey: () => {
				clearSessionSecret("image-api-key");
				set({ imageApiKey: "" });
			},
			setVideoProvider: (providerId) => set({ videoProviderId: providerId }),
			setVideoApiKey: (apiKey) => {
				const trimmed = apiKey.trim();
				if (trimmed) {
					setSessionSecret("video-api-key", trimmed);
				} else {
					clearSessionSecret("video-api-key");
				}
				set({ videoApiKey: apiKey });
			},
			clearVideoApiKey: () => {
				clearSessionSecret("video-api-key");
				set({ videoApiKey: "" });
			},
			setDevPlaceholderEnabled: (enabled) =>
				set({ devPlaceholderEnabled: enabled }),
		}),
		{
			name: "ai-settings",
			partialize: partializeAISettings,
			merge: (persisted, current) => {
				const p = persisted as Partial<AISettingsPersistedState> | undefined;
				return {
					...current,
					...p,
					imageApiKey: current.imageApiKey,
					videoApiKey: current.videoApiKey,
				};
			},
		},
	),
);
