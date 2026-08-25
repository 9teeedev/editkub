import { Command } from "@/lib/commands/base-command";
import type { TimelineElement, TimelineTrack } from "@/types/timeline";
import { EditorCore } from "@/core";

/**
 * Replaces all elements of one track in a single undoable step. Used by
 * the caption rebuild path, where the whole caption track is re-derived
 * from the project transcript.
 */
export class ReplaceTrackElementsCommand extends Command {
	private savedState: TimelineTrack[] | null = null;

	constructor(
		private trackId: string,
		private elements: TimelineElement[],
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();
		const updatedTracks = this.savedState.map((track) =>
			track.id === this.trackId
				? ({ ...track, elements: this.elements } as typeof track)
				: track,
		);
		editor.timeline.updateTracks(updatedTracks);
	}

	undo(): void {
		if (!this.savedState) return;
		const editor = EditorCore.getInstance();
		editor.timeline.updateTracks(this.savedState);
	}
}
