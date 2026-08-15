import type { TCanvasSize } from "@/types/project";
import type {
	PictureInPictureConfig,
	PictureInPicturePreset,
	Transform,
} from "@/types/timeline";

export const PIP_DEFAULTS: Omit<PictureInPictureConfig, "preset"> = {
	borderRadius: 24,
	borderWidth: 4,
	borderColor: "#FFFFFF",
	shadow: true,
};

export function getPictureInPictureTransform({
	preset,
	canvasSize,
	mediaSize,
}: {
	preset: PictureInPicturePreset;
	canvasSize: TCanvasSize;
	mediaSize: { width?: number; height?: number };
}): Transform {
	const sourceWidth = mediaSize.width || canvasSize.width;
	const sourceHeight = mediaSize.height || canvasSize.height;
	const containScale = Math.min(
		canvasSize.width / sourceWidth,
		canvasSize.height / sourceHeight,
	);
	const scale = preset.startsWith("split-") ? 0.5 : 0.38;
	const renderedWidth = sourceWidth * containScale * scale;
	const renderedHeight = sourceHeight * containScale * scale;
	const padding = Math.max(
		16,
		Math.round(Math.min(canvasSize.width, canvasSize.height) * 0.04),
	);

	if (preset === "split-left" || preset === "split-right") {
		return {
			scale,
			position: {
				x:
					preset === "split-left"
						? -canvasSize.width / 4
						: canvasSize.width / 4,
				y: 0,
			},
			rotate: 0,
		};
	}

	const isLeft = preset.endsWith("left");
	const isTop = preset.startsWith("corner-top");

	return {
		scale,
		position: {
			x:
			(isLeft ? -1 : 1) *
			(canvasSize.width / 2 - padding - renderedWidth / 2),
		y:
			(isTop ? -1 : 1) *
			(canvasSize.height / 2 - padding - renderedHeight / 2),
		},
		rotate: 0,
	};
}
