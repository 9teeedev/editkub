import type { TranscriptionResult } from "@/types/transcription";
import type { RemoteTranscriptionProvider, VerboseJsonResponse } from "./types";

/**
 * Groq transcription provider.
 *
 * Uses the OpenAI-compatible `/audio/transcriptions` endpoint with
 * `response_format: "verbose_json"` to get segment-level timestamps.
 * Groq runs Whisper on LPU hardware — significantly faster than local.
 *
 * API keys: https://console.groq.com/keys
 * Docs: https://console.groq.com/docs/speech-text
 */
export const groqProvider: RemoteTranscriptionProvider = {
	id: "groq",
	name: "Groq (Cloud — Fast)",
	requiresApiKey: true,
	models: [
		{ id: "whisper-large-v3-turbo", name: "Whisper Large v3 Turbo" },
		{ id: "whisper-large-v3", name: "Whisper Large v3" },
		{
			id: "distil-whisper-large-v3-en",
			name: "Distil Large v3 (English only)",
		},
	],
	defaultModelId: "whisper-large-v3-turbo",
	apiKeyUrl: "https://console.groq.com/keys",

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
			"https://api.groq.com/openai/v1/audio/transcriptions",
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
				`Groq API error (${response.status}): ${errorText || response.statusText}`,
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
