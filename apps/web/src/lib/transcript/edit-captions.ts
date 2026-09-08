import type { EditorCore } from "@/core";
import { useTranscriptStore } from "@/stores/transcript-store";
import { getTranscriptCaptionGroups } from "./derive-captions";
import { rebuildCaptionTrack } from "./sync-captions";
import { applyGroupTextEdit, joinWordTexts } from "./group-words";

/**
 * Edit one caption group's text through the transcript (the source of
 * truth), then rebuild the caption track. Used by both the Captions Text
 * tab and the text properties panel so the two can never diverge.
 *
 * Returns false when the edit cannot be routed through the transcript
 * (no transcript, unknown group id) — callers should fall back to a
 * direct element edit. Empty/whitespace text is ignored (deleting a
 * caption line is not supported yet) and reported as handled.
 */
export function editCaptionGroupText({
	editor,
	groupId,
	text,
}: {
	editor: EditorCore;
	groupId: string;
	text: string;
}): boolean {
	const current = useTranscriptStore.getState().transcript;
	if (!current) return false;

	const group = getTranscriptCaptionGroups({ transcript: current }).find(
		(candidate) => candidate.id === groupId,
	);
	if (!group) return false;
	const segment = current.segments.find((s) => s.id === group.segmentId);
	if (!segment) return false;

	const chunkIndex = Number.parseInt(group.id.split(":")[1] ?? "0", 10);
	const start = chunkIndex * current.wordsPerGroup;
	const replaced = applyGroupTextEdit({
		words: segment.words.slice(start, start + current.wordsPerGroup),
		text,
	});
	// Empty edits are ignored — deleting a caption line via the
	// transcript is not supported yet.
	if (replaced.length === 0) return true;

	const words = [
		...segment.words.slice(0, start),
		...replaced,
		...segment.words.slice(start + group.words.length),
	];
	const nextSegment = {
		...segment,
		words,
		text: joinWordTexts(words.map((w) => w.text)),
		start: words[0].start,
		end: words[words.length - 1].end,
	};
	const next = {
		...current,
		segments: current.segments.map((s) =>
			s.id === segment.id ? nextSegment : s,
		),
	};
	useTranscriptStore.getState().init(next);
	rebuildCaptionTrack({ editor, transcript: next });
	return true;
}
