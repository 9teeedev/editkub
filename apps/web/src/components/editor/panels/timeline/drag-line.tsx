import {
	TIMELINE_CONSTANTS,
	TRACK_HEIGHTS,
} from "@/constants/timeline-constants";
import { getDropLineY } from "@/lib/timeline/drop-utils";
import { cn } from "@/utils/ui";
import type { TimelineTrack, DropTarget } from "@/types/timeline";

interface DragLineProps {
	dropTarget: DropTarget | null;
	tracks: TimelineTrack[];
	isVisible: boolean;
	headerHeight?: number;
	/** When set (seconds), render a ghost box of the dropped element's span instead of a bare line. */
	previewDuration?: number;
	zoomLevel?: number;
	isSnapped?: boolean;
}

export function DragLine({
	dropTarget,
	tracks,
	isVisible,
	headerHeight = 0,
	previewDuration,
	zoomLevel,
	isSnapped = false,
}: DragLineProps) {
	if (!isVisible || !dropTarget) return null;

	const y = getDropLineY({ dropTarget, tracks });
	const lineTop = y + headerHeight;

	if (previewDuration && previewDuration > 0 && zoomLevel) {
		const targetTrack = tracks[dropTarget.trackIndex];
		const trackHeight =
			TRACK_HEIGHTS[targetTrack?.type ?? "video"] ?? TRACK_HEIGHTS.video;
		const pixelsPerSecond = TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel;
		const left = dropTarget.xPosition * pixelsPerSecond;
		const width = Math.max(2, previewDuration * pixelsPerSecond);

		return (
			<div
				className={cn(
					"border-primary pointer-events-none absolute z-50 rounded-sm border-2",
					isSnapped ? "bg-primary/30" : "bg-primary/10",
				)}
				style={{
					top: `${lineTop + 2}px`,
					height: `${trackHeight - 4}px`,
					left: `${left}px`,
					width: `${width}px`,
				}}
			/>
		);
	}

	return (
		<div
			className="bg-primary pointer-events-none absolute right-0 left-0 z-50 h-0.5"
			style={{ top: `${lineTop}px` }}
		/>
	);
}
