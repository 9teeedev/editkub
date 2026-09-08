import type { CaptionFlowStyle } from "./timeline";

export type { CaptionFlowStyle };

/** A single transcribed word with absolute timeline timing (seconds). */
export interface TranscriptWord {
	text: string;
	start: number;
	end: number;
}

/**
 * A sentence-level grouping of transcript words. Built from word
 * timestamps by splitting on punctuation and speech pauses, so the
 * original Whisper segmentation does not need to be preserved.
 */
export interface TranscriptSegment {
	id: string;
	text: string;
	start: number;
	end: number;
	words: TranscriptWord[];
}

/**
 * Whether word timings came from the model itself or were estimated by
 * spreading words evenly across the segment duration (GPT transcribe
 * models return no timestamps at all).
 */
export type TranscriptWordTiming = "precise" | "estimated";

/**
 * User style overrides applied to EVERY derived caption element on top of
 * the base style + template (see derive-captions). Edited from the
 * Captions Style tab so the whole set restyles together and survives
 * rebuilds.
 */
export interface CaptionStyleOverride {
	fontFamily?: string;
	fontSize?: number;
	color?: string;
	strokeColor?: string;
	strokeWidth?: number;
	/** "transparent" disables the background box. */
	backgroundColor?: string;
	backgroundOpacity?: number;
}

/**
 * Project-level transcript: the source of truth for captions. Timeline
 * caption elements are derived from this (see `lib/transcript`) so text
 * edits, regrouping, and template changes all rebuild deterministically.
 */
export interface TranscriptData {
	language: string;
	/** ISO timestamp of the transcription run. */
	createdAt: string;
	providerId: string;
	modelId: string;
	wordTiming: TranscriptWordTiming;
	/** How many words are shown at once (per caption element). */
	wordsPerGroup: number;
	templateId: string;
	accentColor: string;
	/** Text track that holds the derived caption elements. */
	captionTrackId: string | null;
	styleOverride?: CaptionStyleOverride;
	segments: TranscriptSegment[];
}

/** Template preset describing a caption "flow" look. */
export interface CaptionTemplate {
	templateId: string;
	templateName: string;
	flow: CaptionFlowStyle;
	accentColor: string;
}
