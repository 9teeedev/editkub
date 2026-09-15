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

export interface RippleMoveResult {
	/** Resolved start time for the moved element. */
	startTime: number;
	/** Shift that closes the hole the element leaves behind. Set only when
	 * the move was clamped to the sequence end; interior moves stay untouched. */
	shift: RippleShift | null;
}

/**
 * Ripple editing helper for moving a clip. A destination beyond the end of
 * the remaining sequence lands flush at that end, and the elements after the
 * clip's old position slide left to close the hole it leaves behind (same
 * rule as delete-ripple). A destination that fits inside the sequence is
 * left untouched — no shift — so interior moves never create new overlaps.
 */
export function resolveRippleMove({
	elements,
	movedElementId,
	duration,
	requestedStartTime,
}: {
	/** Main-track elements including the moved one. */
	elements: TimelineElement[];
	movedElementId: string;
	duration: number;
	requestedStartTime: number;
}): RippleMoveResult {
	const moved = elements.find((element) => element.id === movedElementId);
	if (!moved) {
		return { startTime: requestedStartTime, shift: null };
	}

	const others = elements.filter((element) => element.id !== movedElementId);
	const lastEnd = others.reduce(
		(end, element) => Math.max(end, element.startTime + element.duration),
		0,
	);
	if (requestedStartTime + duration <= lastEnd) {
		return { startTime: requestedStartTime, shift: null };
	}

	return {
		startTime: lastEnd,
		shift: getRippleShift({
			elements: others,
			anchorStartTime: moved.startTime,
			targetTime: moved.startTime,
		}),
	};
}
