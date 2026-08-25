import type { TranscriptionResult } from "@/types/transcription";
import type { RemoteTranscriptionProvider, VerboseJsonResponse } from "./types";

interface SimpleJsonResponse {
	text: string;
}

/**
 * OpenRouter transcription provider.
 *
 * Uses the OpenAI-compatible `/audio/transcriptions` endpoint.
 * `whisper-*` models support `verbose_json` (segment timestamps).
 * `gpt-4o-transcribe*` models only support `json` — use `json`.
 *
 * Supports custom model ids — users can enter any OpenRouter STT model.
 *
 * API keys: https://openrouter.ai/keys
 * Docs: https://openrouter.ai/docs/guides/overview/multimodal/stt
 */
export const openrouterProvider: RemoteTranscriptionProvider = {
	id: "openrouter",
	name: "OpenRouter (Cloud)",
	requiresApiKey: true,
	models: [
		{ id: "openai/gpt-transcribe", name: "GPT Transcribe (Best)" },
		{ id: "openai/gpt-4o-transcribe", name: "GPT-4o Transcribe" },
		{ id: "openai/gpt-4o-mini-transcribe", name: "GPT-4o Mini Transcribe" },
		{
			id: "openai/whisper-large-v3-turbo",
			name: "Whisper Large v3 Turbo",
		},
	],
	defaultModelId: "openai/gpt-transcribe",
	apiKeyUrl: "https://openrouter.ai/keys",
	supportsCustomModel: true,

	async transcribe({
		audioBlob,
		apiKey,
		model,
		language,
		wordTimestamps,
	}): Promise<TranscriptionResult> {
		// Only whisper models support verbose_json (segment timestamps).
		// GPT transcribe models (gpt-transcribe, gpt-4o-transcribe, etc.)
		// only support json.
		const useVerbose = model.includes("whisper");

		const formData = new FormData();
		formData.append("file", audioBlob, "audio.wav");
		formData.append("model", model);
		formData.append("response_format", useVerbose ? "verbose_json" : "json");
		// Word granularity makes `segments` come back with one entry per word.
		if (useVerbose && wordTimestamps) {
			formData.append("timestamp_granularities[]", "word");
		}

		if (language && language !== "auto") {
			formData.append("language", language);
		}

		const response = await fetch(
			"https://openrouter.ai/api/v1/audio/transcriptions",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
				},
				body: formData,
			},
		);

		if (!response.ok) {
			const errorText = await response.text().catch(() => "");
			throw new Error(
				`OpenRouter API error (${response.status}): ${errorText || response.statusText}`,
			);
		}

		if (useVerbose) {
			const data = (await response.json()) as VerboseJsonResponse;
			return {
				text: data.text,
				language: data.language ?? language ?? "unknown",
				segments: (data.segments ?? []).map((seg) => ({
					text: seg.text.trim(),
					start: seg.start,
					end: seg.end,
					avgLogprob: seg.avg_logprob,
					noSpeechProb: seg.no_speech_prob,
				})),
			};
		}

		// gpt-4o-transcribe — json response has no segment data
		const data = (await response.json()) as SimpleJsonResponse;
		return {
			text: data.text,
			language: language ?? "unknown",
			segments: [{ text: data.text.trim(), start: 0, end: 0 }],
		};
	},
};
