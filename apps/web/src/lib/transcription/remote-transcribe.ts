import type {
	TranscriptionResult,
	TranscriptionSegment,
} from "@/types/transcription";
import type { RemoteTranscriptionProvider } from "./providers/types";
import { encodeMonoWavBlob } from "@/lib/media/audio";

/**
 * Sample rate used for remote transcription audio.
 * Whisper processes 16 kHz mono internally, so this avoids wasted bandwidth.
 */
const REMOTE_SAMPLE_RATE = 16_000;

/**
 * Duration of each audio chunk sent to a remote provider, in seconds.
 * 5 min × 16 kHz × 2 bytes = ~9.6 MB — well under the 25 MB API limit,
 * fast to upload, and gives frequent progress updates for long clips.
 */
const REMOTE_CHUNK_DURATION_S = 300;

/**
 * Transcribe an arbitrary-length Float32 audio buffer via a remote provider,
 * automatically splitting into chunks that stay under API size limits.
 *
 * Each chunk is sent as a separate 16 kHz mono WAV. Segment timestamps from
 * each chunk are offset by the chunk's start time so the merged result covers
 * the full duration with correct absolute timings.
 *
 * For models that don't return segment timestamps (e.g. gpt-4o-transcribe
 * with `json` response format), the text is spread evenly across the chunk's
 * known audio duration so `buildCaptionChunks` can distribute words correctly.
 *
 * @param onChunkProgress  Called with (completedChunks, totalChunks) after
 *   each chunk finishes — use for UI progress reporting.
 */
export async function transcribeRemote({
	provider,
	samples,
	apiKey,
	model,
	language,
	onChunkProgress,
}: {
	provider: RemoteTranscriptionProvider;
	samples: Float32Array;
	apiKey: string;
	model: string;
	language?: string;
	onChunkProgress?: (completed: number, total: number) => void;
}): Promise<TranscriptionResult> {
	const chunkSize = REMOTE_CHUNK_DURATION_S * REMOTE_SAMPLE_RATE;
	const totalChunks = Math.max(1, Math.ceil(samples.length / chunkSize));

	const allSegments: TranscriptionSegment[] = [];
	let fullText = "";
	let detectedLanguage = "unknown";

	for (let i = 0; i < totalChunks; i++) {
		const startSample = i * chunkSize;
		const endSample = Math.min(startSample + chunkSize, samples.length);
		const chunkSamples = samples.slice(startSample, endSample);
		const offsetS = startSample / REMOTE_SAMPLE_RATE;
		const chunkDurationS = (endSample - startSample) / REMOTE_SAMPLE_RATE;

		const blob = encodeMonoWavBlob(chunkSamples, REMOTE_SAMPLE_RATE);
		const chunkResult = await provider.transcribe({
			audioBlob: blob,
			apiKey,
			model,
			language,
		});

		// Map segments with correct absolute timestamps.
		for (const seg of chunkResult.segments) {
			const hasRealTimestamps = seg.end > seg.start;
			allSegments.push({
				text: seg.text,
				// When a model returns no timestamps (gpt-4o-transcribe json),
				// spread the text across the chunk's known audio duration so
				// buildCaptionChunks distributes words evenly.
				start: (hasRealTimestamps ? seg.start : 0) + offsetS,
				end: (hasRealTimestamps ? seg.end : chunkDurationS) + offsetS,
			});
		}
		fullText += (fullText ? " " : "") + chunkResult.text;
		detectedLanguage = chunkResult.language || detectedLanguage;

		onChunkProgress?.(i + 1, totalChunks);
	}

	return {
		text: fullText,
		segments: allSegments,
		language: detectedLanguage,
	};
}
