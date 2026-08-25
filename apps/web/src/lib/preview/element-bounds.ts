import type { TimelineElement, Transform } from "@/types/timeline";
import type { MediaAsset } from "@/types/assets";
import { getTextScaleFactor } from "@/constants/text-constants";
import { isBottomAlignedSubtitleText } from "@/lib/timeline/text-utils";

export interface ElementHalfSize {
	halfWidth: number;
	halfHeight: number;
}

export function getElementHalfSize({
	element,
	transform,
	mediaMap,
	canvasWidth,
	canvasHeight,
}: {
	element: TimelineElement;
	transform: Transform;
	mediaMap: Map<string, MediaAsset>;
	canvasWidth: number;
	canvasHeight: number;
}): ElementHalfSize | null {
	if (element.type === "video" || element.type === "image") {
		const media = mediaMap.get(element.mediaId);
		const mediaW = media?.width || canvasWidth;
		const mediaH = media?.height || canvasHeight;
		const containScale = Math.min(canvasWidth / mediaW, canvasHeight / mediaH);
		// Crop keeps the uncropped layout; the visible box is the kept
		// sub-rect of the full frame (no re-fit), mirroring the renderer.
		const fullW = mediaW * containScale * transform.scale;
		const fullH = mediaH * containScale * transform.scale;
		const crop = element.crop;
		return {
			halfWidth: crop ? (crop.width * fullW) / 2 : fullW / 2,
			halfHeight: crop ? (crop.height * fullH) / 2 : fullH / 2,
		};
	}

	if (element.type === "text") {
		const scaleFactor = getTextScaleFactor({ canvasWidth, canvasHeight });
		const scaledFontSize = element.fontSize * scaleFactor;
		const elementScale = element.transform.scale;

		const elementBoxWidth = element.boxWidth;
		const hasBoxWidth = elementBoxWidth !== undefined && elementBoxWidth > 0;

		// Thai combining marks (upper/lower vowels, tone marks) stack on
		// the base character and take no horizontal space — counting them
		// as full characters makes the box wider than the drawn text.
		const layoutLength = element.content
			.replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, "")
			.length;

		if (hasBoxWidth) {
			const scaledBoxWidth = elementBoxWidth * scaleFactor;
			const lineHeight = scaledFontSize * 1.3;
			const charsPerLine = Math.max(
				1,
				Math.floor(scaledBoxWidth / (scaledFontSize * 0.6)),
			);
			const lineCount = Math.max(
				1,
				Math.ceil(layoutLength / charsPerLine),
			);
			return {
				halfWidth: (scaledBoxWidth * elementScale) / 2,
				halfHeight: (lineCount * lineHeight * elementScale) / 2,
			};
		}

		return {
			halfWidth:
				(layoutLength * scaledFontSize * 0.6 * elementScale) / 2,
			halfHeight: (scaledFontSize * 1.4 * elementScale) / 2,
		};
	}

	if (element.type === "sticker") {
		const stickerSource = 200;
		const containScale = Math.min(
			canvasWidth / stickerSource,
			canvasHeight / stickerSource,
		);
		const half = (stickerSource * containScale * transform.scale) / 2;
		return { halfWidth: half, halfHeight: half };
	}

	if (element.type === "blur-effect") {
		// Blur effect region: scale relative to canvas size
		// scale=1 → full canvas, scale=0.5 → half canvas
		return {
			halfWidth: (canvasWidth * transform.scale) / 2,
			halfHeight: (canvasHeight * transform.scale) / 2,
		};
	}

	return null;
}

/**
 * Returns the element center in absolute canvas coordinates.
 * position is relative to canvas center; this converts to absolute (0,0 = top-left).
 */
export function getElementCenterInCanvas({
	element,
	transform,
	canvasWidth,
	canvasHeight,
	halfSize,
}: {
	element: TimelineElement;
	transform: Transform;
	canvasWidth: number;
	canvasHeight: number;
	halfSize: ElementHalfSize;
}): { x: number; y: number } {
	const isBottomAlignedText =
		element.type === "text" && isBottomAlignedSubtitleText({ element });

	const centerY = isBottomAlignedText
		? canvasHeight / 2 + transform.position.y - halfSize.halfHeight
		: canvasHeight / 2 + transform.position.y;

	return {
		x: canvasWidth / 2 + transform.position.x,
		y: centerY,
	};
}
