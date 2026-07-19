import type { TextElement } from "@/types/timeline";
import { TIMELINE_CONSTANTS } from "./timeline-constants";

export const MIN_FONT_SIZE = 1;
export const MAX_FONT_SIZE = 38;

/**
 * higher value: smaller font size
 * lower value: larger font size
 */
export const FONT_SIZE_SCALE_REFERENCE = 90;

/**
 * Compute the linear scale factor that maps design-unit fontSize/boxWidth
 * to canvas pixels. Uses min(width, height) so text size is consistent
 * across orientations at the same resolution — a 22pt title renders at the
 * same pixel height in 1920×1080 and 1080×1920.
 *
 * Callers: text-node render, selection overlay, element bounds, preview
 * interaction (resize handles / snapping). All must use this to stay in sync.
 */
export function getTextScaleFactor({
	canvasWidth,
	canvasHeight,
}: {
	canvasWidth: number;
	canvasHeight: number;
}): number {
	const refDim = Math.min(canvasWidth, canvasHeight);
	return refDim / FONT_SIZE_SCALE_REFERENCE;
}

export const DEFAULT_TEXT_ELEMENT: Omit<TextElement, "id"> = {
	type: "text",
	name: "Text",
	content: "Default text",
	fontSize: 15,
	fontFamily: "Arial",
	color: "#ffffff",
	backgroundColor: "transparent",
	textAlign: "center",
	fontWeight: "normal",
	fontStyle: "normal",
	textDecoration: "none",
	duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
	startTime: 0,
	trimStart: 0,
	trimEnd: 0,
	transform: {
		scale: 1,
		position: {
			x: 0,
			y: 0,
		},
		rotate: 0,
	},
	opacity: 1,
};
