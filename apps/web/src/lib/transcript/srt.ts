import type { TranscriptionSegment } from "@/types/transcription";
import type { TranscriptData } from "@/types/transcript";
import { getTranscriptCaptionGroups } from "./derive-captions";
import { joinWordTexts } from "./group-words";

/**
 * SRT import/export for the transcript pipeline.
 *
 * Export derives cues from the transcript's current caption groups (same
 * granularity the timeline shows). Import maps cues onto
 * `TranscriptionSegment[]` so the existing Generate-flow tail
 * (extractWordsFromSegments → buildSentenceSegments → rebuildCaptionTrack)
 * can consume them. Word timing is always "estimated" — SRT only carries
 * cue-level timestamps.
 *
 * Kept dependency-free and tolerant (BOM, CRLF, dot/dot-comma millis,
 * missing indexes, multi-line cues) so it extends cleanly to WebVTT later.
 */

export interface SrtCue {
	start: number;
	end: number;
	text: string;
}

const TIMESTAMP_REGEX =
	/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[,.](\d{1,3})\s*-->\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[,.](\d{1,3})$/;

export function formatSrtTimestamp({ time }: { time: number }): string {
	const clamped = Math.max(0, time);
	const totalMs = Math.round(clamped * 1000);
	const ms = totalMs % 1000;
	const totalSeconds = Math.floor(totalMs / 1000);
	const seconds = totalSeconds % 60;
	const totalMinutes = Math.floor(totalSeconds / 60);
	const minutes = totalMinutes % 60;
	const hours = Math.floor(totalMinutes / 60);

	const hh = String(hours).padStart(2, "0");
	const mm = String(minutes).padStart(2, "0");
	const ss = String(seconds).padStart(2, "0");
	const mmm = String(ms).padStart(3, "0");

	return `${hh}:${mm}:${ss},${mmm}`;
}

function parseTimestampPart(
	hours: string | undefined,
	minutes: string,
	seconds: string,
	millis: string,
): number {
	return (
		(hours ? Number.parseInt(hours, 10) * 3600 : 0) +
		Number.parseInt(minutes, 10) * 60 +
		Number.parseInt(seconds, 10) +
		Number.parseInt(millis.padEnd(3, "0"), 10) / 1000
	);
}

export function parseSrt({ text }: { text: string }): SrtCue[] {
	const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
	const blocks = normalized.split(/\n{2,}/);

	const cues: SrtCue[] = [];
	for (const block of blocks) {
		const lines = block
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0);
		if (lines.length === 0) continue;

		// Skip a leading numeric index line if present.
		const firstLineIndex = /^\d+$/.test(lines[0]) ? 1 : 0;
		const timestampLine = lines[firstLineIndex];
		if (!timestampLine) continue;

		const match = TIMESTAMP_REGEX.exec(timestampLine);
		if (!match) continue;

		const start = parseTimestampPart(match[1], match[2], match[3], match[4]);
		const end = parseTimestampPart(match[5], match[6], match[7], match[8]);
		const cueText = lines.slice(firstLineIndex + 1).join("\n");
		if (!cueText) continue;

		cues.push({ start, end: Math.max(end, start), text: cueText });
	}

	return cues;
}

export function serializeSrt({ cues }: { cues: SrtCue[] }): string {
	return (
		cues
			.map((cue, index) => {
				return [
					String(index + 1),
					`${formatSrtTimestamp({ time: cue.start })} --> ${formatSrtTimestamp({ time: cue.end })}`,
					cue.text,
				].join("\n");
			})
			.join("\n\n") + "\n"
	);
}

/** Cues at the transcript's current words-per-group granularity. */
export function srtCuesFromTranscript({
	transcript,
}: {
	transcript: TranscriptData;
}): SrtCue[] {
	const groups = getTranscriptCaptionGroups({ transcript });
	return groups.map((group) => ({
		start: group.start,
		end: group.end,
		text: joinWordTexts(group.words.map((word) => word.text)),
	}));
}

/** Straight cue → segment mapping for the import pipeline. */
export function srtCuesToTranscriptionSegments({
	cues,
}: {
	cues: SrtCue[];
}): TranscriptionSegment[] {
	return cues.map((cue) => ({
		start: cue.start,
		end: cue.end,
		text: cue.text.replace(/\n/g, " ").trim(),
	}));
}
