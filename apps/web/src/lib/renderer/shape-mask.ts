/**
 * Shape masks for visual elements (circle / rect / star) with feathered edges.
 *
 * The mask is a black-and-white alpha canvas drawn into a reusable target,
 * then composited onto the source via `destination-in` (same pattern as the
 * MODNet background-removal mask). Mask coordinates are normalized [0,1]
 * relative to the source frame, so they're resolution-independent.
 *
 * Feathering uses the canvas `filter: blur(Npx)` on the mask path — cheap
 * and GPU-accelerated on the 2D context.
 */
import {
	createCanvas,
	type DrawableCanvas,
} from "@/lib/renderer/chroma-key";

export type MaskShape = "circle" | "rect" | "star" | "inverted-circle";

export interface ShapeMaskConfig {
	shape: MaskShape;
	/** Center X, normalized [0,1]. Default 0.5. */
	centerX: number;
	/** Center Y, normalized [0,1]. Default 0.5. */
	centerY: number;
	/** Size, normalized [0,1] relative to the shorter frame edge. Default 0.5. */
	size: number;
	/** Rotation in degrees. Default 0. */
	rotation: number;
	/** Feather radius in pixels (edge softness). Default 0. */
	feather: number;
	/** Invert the mask (cut a hole instead of keeping the shape). */
	invert: boolean;
}

export const MASK_DEFAULT: ShapeMaskConfig = {
	shape: "circle",
	centerX: 0.5,
	centerY: 0.5,
	size: 0.5,
	rotation: 0,
	feather: 8,
	invert: false,
};

export const MASK_PRESETS: { id: MaskShape; name: string }[] = [
	{ id: "circle", name: "Circle" },
	{ id: "rect", name: "Rectangle" },
	{ id: "star", name: "Star" },
	{ id: "inverted-circle", name: "Vignette" },
];

/**
 * Build a shape mask canvas of the given dimensions and composite it onto
 * the source via destination-in (keeps source alpha only where the mask
 * is opaque). Writes into `target`.
 */
export function applyShapeMask({
	source,
	sourceWidth,
	sourceHeight,
	config,
	target,
}: {
	source: CanvasImageSource;
	sourceWidth: number;
	sourceHeight: number;
	config: ShapeMaskConfig;
	target: DrawableCanvas;
}): DrawableCanvas {
	const ctx = target.getContext("2d") as Canvas2DContext | null;
	if (!ctx) return target;

	// 1. Draw the source frame.
	ctx.globalCompositeOperation = "source-over";
	ctx.clearRect(0, 0, sourceWidth, sourceHeight);
	ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight);

	// 2. Build the mask path on a scratch canvas.
	const maskCanvas = createCanvas({ width: sourceWidth, height: sourceHeight });
	const maskCtx = maskCanvas.getContext("2d") as Canvas2DContext | null;
	if (!maskCtx) return target;

	const cx = config.centerX * sourceWidth;
	const cy = config.centerY * sourceHeight;
	const minEdge = Math.min(sourceWidth, sourceHeight);
	const radius = (config.size * minEdge) / 2;
	const inverted = config.invert || config.shape === "inverted-circle";

	if (inverted) {
		// Inverted mask: opaque everywhere except inside the shape (a hole).
		// Fill the whole canvas white, then destination-out the shape.
		maskCtx.fillStyle = "#fff";
		maskCtx.fillRect(0, 0, sourceWidth, sourceHeight);
		maskCtx.globalCompositeOperation = "destination-out";
	} else {
		// Normal mask: opaque inside the shape, transparent outside.
		maskCtx.fillStyle = "#fff";
	}

	if (config.feather > 0) {
		maskCtx.filter = `blur(${config.feather}px)`;
	}

	maskCtx.save();
	maskCtx.translate(cx, cy);
	maskCtx.rotate((config.rotation * Math.PI) / 180);

	const shape = config.shape === "inverted-circle" ? "circle" : config.shape;
	switch (shape) {
		case "circle":
			maskCtx.beginPath();
			maskCtx.arc(0, 0, radius, 0, Math.PI * 2);
			maskCtx.fill();
			break;
		case "rect": {
			const w = radius * 2;
			const r = Math.min(w * 0.15, 40);
			roundedRect(maskCtx, -radius, -radius, w, w, r);
			maskCtx.fill();
			break;
		}
		case "star":
			starPath(maskCtx, 0, 0, radius, radius * 0.5, 5);
			maskCtx.fill();
			break;
	}

	maskCtx.restore();
	maskCtx.filter = "none";
	maskCtx.globalCompositeOperation = "source-over";

	// 3. Composite: keep source alpha only where the mask is opaque.
	ctx.globalCompositeOperation = "destination-in";
	ctx.drawImage(maskCanvas, 0, 0, sourceWidth, sourceHeight);
	ctx.globalCompositeOperation = "source-over";

	return target;
}

function roundedRect(
	ctx: Canvas2DContext,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
): void {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

function starPath(
	ctx: Canvas2DContext,
	cx: number,
	cy: number,
	outer: number,
	inner: number,
	points: number,
): void {
	ctx.beginPath();
	for (let i = 0; i < points * 2; i++) {
		const r = i % 2 === 0 ? outer : inner;
		const angle = (i * Math.PI) / points - Math.PI / 2;
		const x = cx + Math.cos(angle) * r;
		const y = cy + Math.sin(angle) * r;
		if (i === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	ctx.closePath();
}

type Canvas2DContext =
	| CanvasRenderingContext2D
	| OffscreenCanvasRenderingContext2D;
