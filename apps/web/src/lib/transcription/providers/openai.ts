import type { TranscriptionResult } from "@/types/transcription";
import type { RemoteTranscriptionProvider, VerboseJsonResponse } from "./types";

/**
 * OpenAI transcription provider.
 *
 * Uses the `/audio/transcriptions` endpoint with
 * `response_format: "verbose_json"` to get segment-level timestamps.
 *
 * API keys: https://platform.openai.com/api-keys
 * Docs: https://platform.openai.com/docs/api-reference/audio/createTranscription
 */
export const openaiProvider: RemoteTranscriptionProvider = {
	id: "openai",
	name: "OpenAI (Cloud)",
	requiresApiKey: true,
	models: [{ id: "whisper-1", name: "Whisper v1" }],
	defaultModelId: "whisper-1",
	apiKeyUrl: "https://platform.openai.com/api-keys",

	async transcribe({
		audioBlob,
		apiKey,
		model,
		language,
	}): Promise<TranscriptionResult> {
		const formData = new FormData();
		formData.append("file", audioBlob, "audio.wav");
		formData.append("model", model);
		formData.append("response_format", "verbose_json");

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
	},
};
