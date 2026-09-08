import type { TranscriptionResult } from "@/types/transcription";
import type { RemoteTranscriptionProvider, VerboseJsonResponse } from "./types";

interface SimpleJsonResponse {
	text: string;
}

/**
 * OpenAI transcription provider.
 *
 * Uses `/audio/transcriptions` endpoint.
 * `whisper-1` supports `verbose_json` (segment timestamps).
 * `gpt-4o-transcribe*` models only support `json` or `text` — use `json`.
 *
 * API keys: https://platform.openai.com/api-keys
 * Docs: https://platform.openai.com/docs/api-reference/audio/createTranscription
 */
export const openaiProvider: RemoteTranscriptionProvider = {
	id: "openai",
	name: "OpenAI (Cloud)",
	requiresApiKey: true,
	models: [
		{ id: "gpt-4o-transcribe", name: "GPT-4o Transcribe (Best)" },
		{ id: "gpt-4o-mini-transcribe", name: "GPT-4o Mini Transcribe" },
		{ id: "whisper-1", name: "Whisper v1 (Legacy)" },
	],
	defaultModelId: "gpt-4o-transcribe",
	apiKeyUrl: "https://platform.openai.com/api-keys",

	async transcribe({
		audioBlob,
		apiKey,
		model,
		language,
		wordTimestamps,
	}): Promise<TranscriptionResult> {
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
			"https://api.openai.com/v1/audio/transcriptions",
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
				`OpenAI API error (${response.status}): ${errorText || response.statusText}`,
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

		// gpt-4o-transcribe / gpt-4o-mini-transcribe — json response has no segments
		const data = (await response.json()) as SimpleJsonResponse;
		return {
			text: data.text,
			language: language ?? "unknown",
			segments: [
				{
					text: data.text.trim(),
					start: 0,
					end: 0,
				},
			],
		};
	},
};
