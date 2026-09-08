import type {
	TranscriptWord,
	TranscriptSegment,
} from "@/types/transcript";
import type { TranscriptionSegment } from "@/types/transcription";

/**
 * Gap between consecutive words (seconds) that is treated as a sentence
 * break when there is no punctuation to split on.
 */
export const SENTENCE_GAP_SECONDS = 0.6;

/** Characters that end a sentence when trailing a word. */
const SENTENCE_ENDING_PUNCT = /[.!?…;。！？；]$/u;

/** Minimum duration of a single derived caption element (seconds). */
export const MIN_CAPTION_ELEMENT_DURATION = 0.3;

/**
 * Flatten transcription segments into words with timing.
 *
 * Word-level results (whisper `return_timestamps: "word"` or remote
 * `timestamp_granularities[]=word`) arrive as one segment per word — those
 * keep their exact timing. Segment-level results carry several words per
 * segment, so the words are spread evenly across the segment span as an
 * estimate (this is what karaoke highlighting falls back to).
 *
 * Returns the words plus whether every word has model-provided timing.
 */
export function extractWordsFromSegments({
	segments,
}: {
	segments: TranscriptionSegment[];
}): { words: TranscriptWord[]; timing: "precise" | "estimated" } {
	const words: TranscriptWord[] = [];
	let multiWordSegments = 0;

	for (const segment of segments) {
		const text = segment.text.trim();
		if (!text) continue;

		// Word-level results arrive as one segment per word/token; those
		// keep their exact timing. Thai tokens from the model may still be
		// multi-word phrases (no spaces), so they are dictionary-split and
		// interpolated — counted as estimated.
		const tokens = tokenizeWords(text);

		if (tokens.length <= 1) {
			words.push({
				text,
				start: segment.start,
				end: Math.max(segment.end, segment.start),
			});
			continue;
		}

		multiWordSegments++;
		words.push(
			...distributeWords({
				tokens,
				start: segment.start,
				end: segment.end,
			}),
		);
	}

	return {
		words,
		timing: multiWordSegments > 0 ? "estimated" : "precise",
	};
}

/**
 * Group words into sentence-level segments by punctuation and speech
 * pauses. Word timings come from the model, so sentence grouping is purely
 * derived — edits to a sentence keep working afterwards.
 */
export function buildSentenceSegments({
	words,
}: {
	words: TranscriptWord[];
}): TranscriptSegment[] {
	const segments: TranscriptSegment[] = [];
	let current: TranscriptWord[] = [];

	const flush = () => {
		if (current.length === 0) return;
		segments.push({
			id: `seg-${segments.length}`,
			text: joinWordTexts(current.map((w) => w.text)),
			start: current[0].start,
			end: current[current.length - 1].end,
			words: current,
		});
		current = [];
	};

	for (let i = 0; i < words.length; i++) {
		const word = words[i];
		current.push(word);

		const next = words[i + 1];
		const endsSentence = SENTENCE_ENDING_PUNCT.test(word.text);
		const hasGap = next !== undefined && next.start - word.end > SENTENCE_GAP_SECONDS;

		if (endsSentence || hasGap || next === undefined) {
			flush();
		}
	}

	return segments;
}

/**
 * A run of consecutive words from one sentence that is shown as a single
 * caption element on screen.
 */
export interface CaptionGroup {
	id: string;
	segmentId: string;
	words: TranscriptWord[];
	start: number;
	end: number;
}

/**
 * Split sentence segments into caption groups of at most `wordsPerGroup`
 * words. Groups never cross a sentence boundary.
 */
export function buildCaptionGroups({
	segments,
	wordsPerGroup,
}: {
	segments: TranscriptSegment[];
	wordsPerGroup: number;
}): CaptionGroup[] {
	const size = Math.max(1, Math.floor(wordsPerGroup));
	const groups: CaptionGroup[] = [];

	for (const segment of segments) {
		for (let i = 0; i < segment.words.length; i += size) {
			const words = segment.words.slice(i, i + size);
			groups.push({
				id: `${segment.id}:${i / size}`,
				segmentId: segment.id,
				words,
				start: words[0].start,
				end: Math.max(
					words[words.length - 1].end,
					words[0].start + MIN_CAPTION_ELEMENT_DURATION,
				),
			});
		}
	}

	return groups;
}

const THAI_CHAR = /[\u0E00-\u0E7F]/;

/** True when the text contains Thai characters (written without spaces). */
function isThaiText(text: string): boolean {
	return THAI_CHAR.test(text);
}

const thaiSegmenter =
	typeof Intl !== "undefined" && "Segmenter" in Intl
		? new Intl.Segmenter("th", { granularity: "word" })
		: null;

/**
 * Split text into display words. Thai has no inter-word spaces, so a
 * whitespace split would leave whole phrases glued together as one
 * "word" — use the platform dictionary segmenter instead. Falls back to
 * whitespace splitting for non-Thai text or missing Segmenter support.
 */
export function tokenizeWords(text: string): string[] {
	const trimmed = text.trim();
	if (trimmed === "") return [];

	if (isThaiText(trimmed) && thaiSegmenter) {
		const parts = Array.from(thaiSegmenter.segment(trimmed))
			.filter((part) => part.isWordLike)
			.map((part) => part.segment)
			.filter(Boolean);
		if (parts.length > 0) return parts;
	}

	return trimmed.split(/\s+/).filter(Boolean);
}

/**
 * Spread tokens across [start, end] weighted by character length, so
 * longer words hold the screen proportionally longer.
 */
function distributeWords({
	tokens,
	start,
	end,
}: {
	tokens: string[];
	start: number;
	end: number;
}): TranscriptWord[] {
	const lengths = tokens.map((token) => Array.from(token).length);
	const totalChars = lengths.reduce((sum, n) => sum + n, 0);
	if (totalChars === 0) return [];

	const span = Math.max(0, end - start);
	let cursor = start;
	return tokens.map((token, i) => {
		const duration = (span * lengths[i]) / totalChars;
		const word = { text: token, start: cursor, end: cursor + duration };
		cursor += duration;
		return word;
	});
}

/**
 * Join word texts into display text. Thai words are written without
 * spaces, everything else gets a space between words.
 */
export function joinWordTexts(texts: string[]): string {
	if (texts.length === 0) return "";
	const thai = texts.every((text) => THAI_CHAR.test(text));
	return texts.join(thai ? "" : " ");
}

/**
 * Replace the words of one caption group with edited text. Tokens are
 * spread evenly across the group's original span, matching the estimate
 * strategy used for segment-level transcription results.
 */
export function applyGroupTextEdit({
	words,
	text,
}: {
	words: TranscriptWord[];
	text: string;
}): TranscriptWord[] {
	const start = words[0].start;
	const end = words[words.length - 1].end;
	const span = Math.max(MIN_CAPTION_ELEMENT_DURATION, end - start);
	const tokens = tokenizeWords(text);

	if (tokens.length === 0) return [];

	return distributeWords({ tokens, start, end: start + span });
}
