import { groqProvider } from "./groq";
import { openaiProvider } from "./openai";
import { openrouterProvider } from "./openrouter";
import type { RemoteTranscriptionProvider } from "./types";

/**
 * Local provider pseudo-entry — no API needed, uses in-browser Whisper.
 * Not a real RemoteTranscriptionProvider (no transcribe method), but
 * included in the provider list for the UI dropdown.
 */
export const LOCAL_PROVIDER = {
	id: "local",
	name: "Local (Private — In-browser)",
	requiresApiKey: false,
} as const;

/** All selectable providers (local + remote). */
export const TRANSCRIPTION_PROVIDERS = [
	LOCAL_PROVIDER,
	groqProvider,
	openaiProvider,
	openrouterProvider,
] as const;

/** Remote-only providers (those with a `transcribe()` method). */
export const REMOTE_PROVIDERS: RemoteTranscriptionProvider[] = [
	groqProvider,
	openaiProvider,
	openrouterProvider,
];

/** Look up a remote provider by id. Returns undefined if not found or local. */
export function getRemoteProvider(
	id: string,
): RemoteTranscriptionProvider | undefined {
	return REMOTE_PROVIDERS.find((p) => p.id === id);
}

/** Whether a provider id refers to a remote (cloud) provider. */
export function isRemoteProvider(id: string): boolean {
	return id !== "local" && REMOTE_PROVIDERS.some((p) => p.id === id);
}
