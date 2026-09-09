import { Command } from "@/lib/commands/base-command";
import type { TimelineTrack } from "@/types/timeline";
import { EditorCore } from "@/core";
import { getRippleShift, applyRippleShift } from "@/lib/timeline/ripple-utils";
import { useTimelineStore } from "@/stores/timeline-store";

export class UpdateElementDurationCommand extends Command {
	private savedState: TimelineTrack[] | null = null;

	constructor(
		private trackId: string,
		private elementId: string,
		private duration: number,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const rippleEnabled = useTimelineStore.getState().rippleEditingEnabled;

		const updatedTracks = this.savedState.map((t) => {
			if (t.id !== this.trackId) return t;
			const newElements = t.elements.map((el) =>
				el.id === this.elementId ? { ...el, duration: this.duration } : el,
			);

			if (!rippleEnabled) {
				return { ...t, elements: newElements } as typeof t;
			}

			const savedElement = t.elements.find((el) => el.id === this.elementId);
			if (!savedElement) {
				return { ...t, elements: newElements } as typeof t;
			}

			// Only an end-time change ripples: a left-edge trim shifts the
			// start instead and keeps the end (and the following clips) put.
			const newEnd = savedElement.startTime + this.duration;
			const shift = getRippleShift({
				elements: newElements,
				anchorStartTime: savedElement.startTime,
				targetTime: newEnd,
			});

			if (!shift) {
				return { ...t, elements: newElements } as typeof t;
			}

			return {
				...t,
				elements: applyRippleShift({ elements: newElements, shift }),
			} as typeof t;
		});

		editor.timeline.updateTracks(updatedTracks);
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}
}
