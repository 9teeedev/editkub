import type {
	TrackType,
	TimelineTrack,
	ElementType,
	VideoTrack,
	AudioTrack,
	StickerTrack,
	TextTrack,
	TimelineElement,
} from "@/types/timeline";
import {
	TRACK_COLORS,
	TRACK_HEIGHTS,
	TRACK_GAP,
} from "@/constants/timeline-constants";
import { generateUUID } from "@/utils/id";

export function canTracktHaveAudio(
	track: TimelineTrack,
): track is VideoTrack | AudioTrack {
	return track.type === "audio" || track.type === "video";
}

export function canTrackBeHidden(
	track: TimelineTrack,
): track is VideoTrack | TextTrack | StickerTrack {
	return track.type !== "audio";
}

export function getTrackColor({ type }: { type: TrackType }) {
	return TRACK_COLORS[type];
}

export function getTrackClasses({ type }: { type: TrackType }) {
	const colors = TRACK_COLORS[type];
	return `${colors.background}`.trim();
}

export function getTrackHeight({ type }: { type: TrackType }): number {
	return TRACK_HEIGHTS[type];
}

export function getCumulativeHeightBefore({
	tracks,
	trackIndex,
}: {
	tracks: Array<{ type: TrackType }>;
	trackIndex: number;
}): number {
	return tracks
		.slice(0, trackIndex)
		.reduce(
			(sum, track) => sum + getTrackHeight({ type: track.type }) + TRACK_GAP,
			0,
		);
}

export function getTotalTracksHeight({
	tracks,
}: {
	tracks: Array<{ type: TrackType }>;
}): number {
	const tracksHeight = tracks.reduce(
		(sum, track) => sum + getTrackHeight({ type: track.type }),
		0,
	);
	const gapsHeight = Math.max(0, tracks.length - 1) * TRACK_GAP;
	return tracksHeight + gapsHeight;
}

export function buildEmptyTrack({
	id,
	type,
	name,
}: {
	id: string;
	type: TrackType;
	name?: string;
}): TimelineTrack {
	const trackName =
		name ??
		(type === "video"
			? "Video track"
			: type === "text"
				? "Text track"
				: type === "audio"
					? "Audio track"
					: type === "sticker"
						? "Sticker track"
						: "Track");

	switch (type) {
		case "video":
			return {
				id,
				name: trackName,
				type: "video",
				elements: [],
				hidden: false,
				muted: false,
				isMain: false,
			};
		case "text":
			return {
				id,
				name: trackName,
				type: "text",
				elements: [],
				hidden: false,
			};
		case "sticker":
			return {
				id,
				name: trackName,
				type: "sticker",
				elements: [],
				hidden: false,
			};
		case "audio":
			return {
				id,
				name: trackName,
				type: "audio",
				elements: [],
				muted: false,
			};
		default:
			throw new Error(`Unsupported track type: ${type}`);
	}
}

export function getDefaultInsertIndexForTrack({
	tracks,
	trackType,
}: {
	tracks: TimelineTrack[];
	trackType: TrackType;
}): number {
	if (trackType === "audio") {
		return tracks.length;
	}

	const mainTrackIndex = tracks.findIndex((track) => isMainTrack(track));
	if (mainTrackIndex >= 0) {
		return mainTrackIndex;
	}

	const firstAudioTrackIndex = tracks.findIndex(
		(track) => track.type === "audio",
	);
	if (firstAudioTrackIndex >= 0) {
		return firstAudioTrackIndex;
	}

	return tracks.length;
}

export function getHighestInsertIndexForTrack({
	tracks,
	trackType,
}: {
	tracks: TimelineTrack[];
	trackType: TrackType;
}): number {
	const mainTrackIndex = tracks.findIndex((track) => isMainTrack(track));

	if (trackType === "audio") {
		return mainTrackIndex >= 0 ? mainTrackIndex + 1 : tracks.length;
	}

	return 0;
}

export function isMainTrack(track: TimelineTrack): track is VideoTrack {
	return track.type === "video" && track.isMain === true;
}

export function getMainTrack({
	tracks,
}: {
	tracks: TimelineTrack[];
}): TimelineTrack | null {
	return tracks.find((track) => isMainTrack(track)) ?? null;
}

export function ensureMainTrack({
	tracks,
}: {
	tracks: TimelineTrack[];
}): TimelineTrack[] {
	const hasMainTrack = tracks.some((track) => isMainTrack(track));

	if (!hasMainTrack) {
		const mainTrack: TimelineTrack = {
			id: generateUUID(),
			name: "Main Track",
			type: "video",
			elements: [],
			muted: false,
			isMain: true,
			hidden: false,
		};
		return [mainTrack, ...tracks];
	}

	return tracks;
}

export function canElementGoOnTrack({
	elementType,
	trackType,
}: {
	elementType: ElementType;
	trackType: TrackType;
}): boolean {
	if (elementType === "text") return trackType === "text";
	if (elementType === "audio") return trackType === "audio";
	if (elementType === "sticker") return trackType === "sticker";
	if (elementType === "video" || elementType === "image") {
		return trackType === "video";
	}
	return false;
}

/**
 * Detect whether the given element has any visible content (on other tracks)
 * rendering *below* it in z-order, overlapping the same time range.
 *
 * "Below" follows the renderer's stacking: overlay tracks (text/sticker/non-main
 * video) render above the main track; within a track, earlier elements render
 * underneath later ones only via transitions. For blend-mode UX we treat
 * "content below" as: any non-hidden element on any other visible track whose
 * time range overlaps [start, end). Used by the Blend Mode panel to hint that
 * blend modes only composite against underlying content (a single clip over the
 * default black background yields black for multiply/color-burn/hue/etc).
 */
export function hasContentBelowElement({
	tracks,
	trackId,
	elementId,
}: {
	tracks: TimelineTrack[];
	trackId: string;
	elementId: string;
}): boolean {
	// Find the source element + validate.
	let target: TimelineElement | null = null;
	for (const t of tracks) {
		const found = t.elements.find((e) => e.id === elementId);
		if (found) {
			target = found;
			break;
		}
	}
	if (!target) return false;

	const targetStart = target.startTime;
	const targetEnd = target.startTime + target.duration;

	for (const t of tracks) {
		if ("hidden" in t && t.hidden) continue;
		for (const e of t.elements) {
			if (e.id === elementId) continue;
			if ("hidden" in e && e.hidden) continue;
			if (e.type === "audio") continue; // audio doesn't render pixels
			const eEnd = e.startTime + e.duration;
			// Overlap test (half-open like the renderer's range check).
			if (e.startTime < targetEnd && eEnd > targetStart) {
				return true;
			}
		}
	}
	return false;
}

export function validateElementTrackCompatibility({
	element,
	track,
}: {
	element: { type: ElementType };
	track: { type: TrackType };
}): { isValid: boolean; errorMessage?: string } {
	const isValid = canElementGoOnTrack({
		elementType: element.type,
		trackType: track.type,
	});

	if (!isValid) {
		return {
			isValid: false,
			errorMessage: `${element.type} elements cannot be placed on ${track.type} tracks`,
		};
	}

	return { isValid: true };
}

export function getEarliestMainTrackElement({
	tracks,
	excludeElementId,
}: {
	tracks: TimelineTrack[];
	excludeElementId?: string;
}): TimelineElement | null {
	const mainTrack = getMainTrack({ tracks });
	if (!mainTrack) {
		return null;
	}

	const elements = mainTrack.elements.filter(
		(element) => !excludeElementId || element.id !== excludeElementId,
	);

	if (elements.length === 0) {
		return null;
	}

	return elements.reduce((earliest, element) =>
		element.startTime < earliest.startTime ? element : earliest,
	);
}

export function enforceMainTrackStart({
	tracks,
	targetTrackId,
	requestedStartTime,
	excludeElementId,
	enabled = true,
}: {
	tracks: TimelineTrack[];
	targetTrackId: string;
	requestedStartTime: number;
	excludeElementId?: string;
	/**
	 * Whether the "main track must start at 0" constraint should be applied.
	 * When the Auto Snapping toggle is off, callers pass `enabled: false` so
	 * the user can drag the first clip away from time 0.
	 */
	enabled?: boolean;
}): number {
	// When disabled (snapping off), honour the requested start time verbatim.
	if (!enabled) {
		return requestedStartTime;
	}

	const mainTrack = getMainTrack({ tracks });
	if (!mainTrack || mainTrack.id !== targetTrackId) {
		return requestedStartTime;
	}

	const earliestElement = getEarliestMainTrackElement({
		tracks,
		excludeElementId,
	});

	if (!earliestElement) {
		return 0;
	}

	// main track must always start at time 0; if this element would
	// become the earliest, pin it to the start
	if (requestedStartTime <= earliestElement.startTime) {
		return 0;
	}

	return requestedStartTime;
}
