import { Command } from "@/lib/commands/base-command";
import type { SilenceSegment } from "@/lib/audio/silence-detection";
import type { TimelineTrack } from "@/types/timeline";
import { EditorCore } from "@/core";
import { generateUUID } from "@/utils/id";

/**
 * Remove silence from an element by splitting it into the kept (non-silent)
 * sub-segments and repositioning them back-to-back, closing the silent gaps.
 *
 * The source element is replaced by N new elements (one per kept segment),
 * each pointing into the same media with adjusted trimStart/duration.
 * They are laid out consecutively starting at the original element's
 * startTime, so the clip "compacts" — total duration shrinks by the total
 * silent time removed.
 *
 * Single snapshot → single undo. Selection is set to the new sub-elements.
 */
export class RemoveSilenceCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private previousSelection: { trackId: string; elementId: string }[] = [];
	private createdElements: { trackId: string; elementId: string }[] = [];

	constructor(
		private target: { trackId: string; elementId: string },
		/**
		 * Kept segments in *source-local* time (seconds from trimStart).
		 * The union of these ranges is what survives; everything else is cut.
		 */
		private keptSegments: SilenceSegment[],
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();
		this.previousSelection = editor.selection.getSelectedElements();
		this.createdElements = [];

		if (this.keptSegments.length === 0) {
			// Nothing to keep — leave element as-is (degenerate case).
			return;
		}

		const updatedTracks = this.savedState.map((track) => {
			if (track.id !== this.target.trackId) return track;

			const targetIdx = track.elements.findIndex(
				(el) => el.id === this.target.elementId,
			);
			if (targetIdx === -1) return track;

			const source = track.elements[targetIdx];
			const originalStart = source.startTime;
			const sourceTrimStart = source.trimStart;

			// Build sub-elements for each kept segment, laid out back-to-back.
			let runningStart = originalStart;
			const subElements = this.keptSegments.map((seg, i) => {
				const segDuration = seg.end - seg.start;
				const isFirst = i === 0;

				// First sub-element reuses the original id so other references
				// (selection, links) survive; subsequent ones get fresh ids.
				const id = isFirst ? source.id : generateUUID();
				this.createdElements.push({ trackId: track.id, elementId: id });

				const el = {
					...source,
					id,
					name:
						this.keptSegments.length === 1
							? source.name
							: `${source.name} (${i + 1}/${this.keptSegments.length})`,
					startTime: runningStart,
					duration: segDuration,
					trimStart: sourceTrimStart + seg.start,
					trimEnd: 0,
				};
				runningStart += segDuration;
				return el;
			});

			const newElements = [
				...track.elements.slice(0, targetIdx),
				...subElements,
				...track.elements.slice(targetIdx + 1),
			];

			return { ...track, elements: newElements } as typeof track;
		});

		editor.timeline.updateTracks(updatedTracks);

		if (this.createdElements.length > 0) {
			editor.selection.setSelectedElements({
				elements: this.createdElements,
			});
		}
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
			editor.selection.setSelectedElements({
				elements: this.previousSelection,
			});
		}
	}
}
