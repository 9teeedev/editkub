import type { TimelineElement } from "@/types/timeline";

export interface RippleShift {
	/** Seconds to subtract from each shifted element's startTime. */
	shift: number;
	/** IDs of the elements after the edit point, in timeline order. */
	elementIds: string[];
}

const EPSILON = 1e-9;

/**
 * Ripple editing helper: when an edit shortens or removes part of a track,
 * the elements after the edit point slide so the first one lands exactly on
 * `targetTime`, preserving the spacing between them. Returns null when there
 * is nothing after the edit point or no shift is needed.
 */
export function getRippleShift({
	elements,
	anchorStartTime,
	targetTime,
}: {
	/** Remaining elements on the track (the edited one may still be present). */
	elements: TimelineElement[];
	/** Start time of the deleted span, or of the element being trimmed. */
	anchorStartTime: number;
	/** Where the first subsequent element should land (new end time). */
	targetTime: number;
}): RippleShift | null {
	const subsequent = elements
		.filter((element) => element.startTime > anchorStartTime + EPSILON)
		.sort((a, b) => a.startTime - b.startTime);

	if (subsequent.length === 0) return null;

	const shift = subsequent[0].startTime - targetTime;
	if (Math.abs(shift) < EPSILON) return null;

	return { shift, elementIds: subsequent.map((element) => element.id) };
}

/** Apply a ripple shift to a track's elements (immutable). */
export function applyRippleShift({
	elements,
	shift,
}: {
	elements: TimelineElement[];
	shift: RippleShift;
}): TimelineElement[] {
	const shiftedIds = new Set(shift.elementIds);
	return elements.map((element) =>
		shiftedIds.has(element.id)
			? { ...element, startTime: Math.max(0, element.startTime - shift.shift) }
			: element,
	);
}
