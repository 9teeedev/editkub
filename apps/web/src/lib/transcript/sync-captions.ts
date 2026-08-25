import type { EditorCore } from "@/core";
import type { TranscriptData } from "@/types/transcript";
import type { TextElement, TimelineElement } from "@/types/timeline";
import { ReplaceTrackElementsCommand } from "@/lib/commands/timeline/element/replace-track-elements";
import { ensureCanvasFontLoaded } from "@/lib/canvas-fonts";
import { deriveCaptionElements } from "./derive-captions";

/**
 * Rebuild the caption track so it matches the transcript's current text,
 * grouping, and template. One undo entry covers the whole rebuild.
 *
 * The caption track is created on first generation and then reused, so
 * manually added neighbor tracks are never touched. Element ids are
 * regenerated on each rebuild — caption elements are always derived
 * data, never hand-authored.
 */
export function rebuildCaptionTrack({
	editor,
	transcript,
}: {
	editor: EditorCore;
	transcript: TranscriptData;
}): { trackId: string; count: number } {
	let trackId = transcript.captionTrackId;
	if (trackId) {
		const exists = editor.timeline
			.getTracks()
			.some((track) => track.id === trackId);
		if (!exists) trackId = null;
	}

	if (!trackId) {
		trackId = editor.timeline.addTrack({ type: "text", index: 0 });
	}

	const canvasSize =
		editor.project.getActiveOrNull()?.settings.canvasSize ??
		{ width: 1920, height: 1080 };

	const created = deriveCaptionElements({
		transcript,
		canvasWidth: canvasSize.width,
		canvasHeight: canvasSize.height,
	});
	const elements: TimelineElement[] = created.map((element) => ({
		...element,
		id: crypto.randomUUID(),
	})) as TimelineElement[];

	editor.command.execute({
		command: new ReplaceTrackElementsCommand(trackId, elements),
	});

	// Kanit loads lazily on first caption generation; once the real font
	// metrics are available, nudge selection so overlays re-measure.
	void ensureCanvasFontLoaded("Kanit").then(() => {
		editor.selection.setSelectedElements({
			elements: editor.selection.getSelectedElements(),
		});
	});

	return { trackId, count: elements.length };
}

/**
 * Find the caption elements currently on the caption track (empty when no
 * transcript has been generated yet).
 */
export function getCaptionElements({
	editor,
	transcript,
}: {
	editor: EditorCore;
	transcript: TranscriptData | null;
}): TextElement[] {
	if (!transcript?.captionTrackId) return [];
	const track = editor.timeline
		.getTracks()
		.find((t) => t.id === transcript.captionTrackId);
	if (!track) return [];
	return track.elements.filter(
		(element): element is TextElement =>
			element.type === "text" && element.wordTimings !== undefined,
	);
}
