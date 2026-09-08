/**
 * Source-space cropping for media elements.
 *
 * The crop rect is normalized [0,1] against the uncropped source frame and
 * selects the region that is kept. The renderer draws only the kept sub-rect
 * at its original position inside the uncropped layout, so edges that aren't
 * cropped stay put (cut-away semantics, no re-fit).
 */
import type { CropConfig } from "@/types/timeline";

export type { CropConfig };

export const CROP_DEFAULT: CropConfig = {
	x: 0,
	y: 0,
	width: 1,
	height: 1,
};

/** Smallest allowed crop edge (normalized) so handles never collapse. */
export const MIN_CROP = 0.05;

export interface CropPreset {
	id: string;
	label: string;
	/** Width/height ratio; null = freeform (no constraint). */
	ratio: number | null;
}

export const CROP_PRESETS: CropPreset[] = [
	{ id: "free", label: "Free", ratio: null },
	{ id: "1-1", label: "1:1", ratio: 1 },
	{ id: "16-9", label: "16:9", ratio: 16 / 9 },
	{ id: "9-16", label: "9:16", ratio: 9 / 16 },
	{ id: "4-3", label: "4:3", ratio: 4 / 3 },
];

/** True when the config keeps the whole frame (crop is a no-op). */
export function isFullCrop(crop: CropConfig | undefined): boolean {
	return (
		!crop ||
		(crop.x <= 0 &&
			crop.y <= 0 &&
			crop.width >= 1 &&
			crop.height >= 1)
	);
}

/** Largest centered crop rect matching `ratio` inside the source frame. */
export function cropRectForAspect({
	sourceWidth,
	sourceHeight,
	ratio,
}: {
	sourceWidth: number;
	sourceHeight: number;
	ratio: number;
}): CropConfig {
	const sourceRatio = sourceWidth / sourceHeight;
	let width = 1;
	let height = 1;
	if (ratio > sourceRatio) {
		// Target is wider than the source: keep full width, shrink height.
		height = sourceRatio / ratio;
	} else {
		width = ratio / sourceRatio;
	}
	return {
		x: (1 - width) / 2,
		y: (1 - height) / 2,
		width,
		height,
	};
}
