"use client";

import { useRef, useCallback, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";

interface TimelineScrollState {
	zoomLevel: number;
}

/**
 * Manages horizontal scroll position and zoom level for the mobile timeline.
 *
 * Uses a "centered playhead" model: the playhead stays fixed at screen center
 * and timeline content scrolls underneath. Panning converts pixel deltas to
 * time deltas and seeks the playhead. Pinch-zoom adjusts zoom within bounds.
 *
 * `zoomLevel` is mirrored into state so track widths and the ruler re-render
 * on pinch; the ref copy keeps timeToPixels/pixelsToTime always fresh without
 * re-creating callbacks.
 */
export function useTimelineScroll() {
	const editor = useEditor();
	const [zoomLevel, setZoomLevelState] = useState(1);
	const stateRef = useRef<TimelineScrollState>({
		zoomLevel: 1,
	});

	const applyZoom = useCallback((nextZoomLevel: number) => {
		const clamped = Math.min(
			TIMELINE_CONSTANTS.ZOOM_MAX,
			Math.max(TIMELINE_CONSTANTS.ZOOM_MIN, nextZoomLevel),
		);
		stateRef.current.zoomLevel = clamped;
		setZoomLevelState(clamped);
	}, []);

	const timeToPixels = useCallback(({ time }: { time: number }): number => {
		return (
			time * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * stateRef.current.zoomLevel
		);
	}, []);

	const pixelsToTime = useCallback(({ pixels }: { pixels: number }): number => {
		return (
			pixels /
			(TIMELINE_CONSTANTS.PIXELS_PER_SECOND * stateRef.current.zoomLevel)
		);
	}, []);

	const handlePan = useCallback(
		({ deltaX }: { deltaX: number }) => {
			const timeDelta = pixelsToTime({ pixels: -deltaX });
			const currentTime = editor.playback.getCurrentTime();
			const newTime = currentTime + timeDelta;
			editor.playback.seek({ time: Math.max(0, newTime) });
		},
		[editor, pixelsToTime],
	);

	const handlePinch = useCallback(
		({ scale }: { scale: number }) => {
			applyZoom(stateRef.current.zoomLevel * scale);
		},
		[applyZoom],
	);

	const getZoomLevel = useCallback((): number => {
		return stateRef.current.zoomLevel;
	}, []);

	const setZoomLevel = useCallback(
		({ zoomLevel: nextZoomLevel }: { zoomLevel: number }) => {
			applyZoom(nextZoomLevel);
		},
		[applyZoom],
	);

	return {
		zoomLevel,
		timeToPixels,
		pixelsToTime,
		handlePan,
		handlePinch,
		getZoomLevel,
		setZoomLevel,
	};
}
