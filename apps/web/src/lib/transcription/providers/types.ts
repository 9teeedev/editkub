import type { TranscriptionResult } from "@/types/transcription";

export interface RemoteTranscriptionModel {
	id: string;
	name: string;
}

/**
 * A remote (cloud-based) transcription provider. Each provider implements a
 * `transcribe()` method that sends audio to a cloud API and returns a
 * `TranscriptionResult` with the same shape as the local Whisper pipeline.
 *
 * API keys are stored client-side (localStorage via zustand persist) and
 * passed directly to the provider — never sent through our own server.
 */
export interface RemoteTranscriptionProvider {
	/** Unique identifier: "groq" | "openai" */
	id: string;
	/** Display name for dropdowns */
	name: string;
	/** Whether this provider requires an API key */
	requiresApiKey: boolean;
	/** Available models on this provider */
	models: RemoteTranscriptionModel[];
	/** Default model id */
	defaultModelId: string;
	/** URL to obtain an API key */
	apiKeyUrl: string;
	/** Whether this provider allows entering a custom model id */
	supportsCustomModel?: boolean;
	/**
	 * Transcribe audio using this provider's cloud API.
	 * Throws on HTTP error or invalid response.
	 */
	transcribe(params: {
		audioBlob: Blob;
		apiKey: string;
		model: string;
		language?: string;
	}): Promise<TranscriptionResult>;
}

/** Options shared by OpenAI-compatible transcription APIs (Groq, OpenAI). */
export interface VerboseJsonSegment {
	text: string;
	start: number;
	end: number;
	avg_logprob?: number;
	no_speech_prob?: number;
}

export interface VerboseJsonResponse {
	text: string;
	language?: string;
	segments?: VerboseJsonSegment[];
}
