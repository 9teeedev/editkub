import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import type { ElementKeyframes, Transform } from "@/types/timeline";
import { resolveAnimatedProperties } from "@/lib/timeline/keyframe-utils";

export type BlurEffectNodeParams = {
	blurIntensity: number;
	boxWidth?: number;
	boxHeight?: number;
	duration: number;
	timeOffset: number;
	trimStart: number;
	trimEnd: number;
	transform: Transform;
	opacity: number;
	keyframes?: ElementKeyframes;
};

const VISUAL_EPSILON = 1 / 1000;

/**
 * Renders a localized blur region on the canvas. Unlike
 * `BlurBackgroundNode` (which blurs the entire frame as a background),
 * this node captures the current canvas content within the element's
 * transform region and redraws it blurred.
 *
 * The blur region is determined by `transform.position` (center offset
 * from canvas center) and `transform.scale` (region size relative to
 * canvas). `blurIntensity` (0–100) controls blur radius.
 */
export class BlurEffectNode extends BaseNode<BlurEffectNodeParams> {
	private isInRange(time: number): boolean {
		const elapsed = time - this.params.timeOffset;
		return elapsed >= -VISUAL_EPSILON && elapsed < this.params.duration;
	}

	async render({
		renderer,
		time,
	}: {
		renderer: CanvasRenderer;
		time: number;
	}): Promise<void> {
		if (!this.isInRange(time)) return;

		const ctx = renderer.context;

		// Resolve animated transform/opacity for this frame
		const localTime = time - this.params.timeOffset;
		const { transform, opacity } = resolveAnimatedProperties({
			keyframes: this.params.keyframes,
			time: localTime,
			baseTransform: this.params.transform,
			baseOpacity: this.params.opacity,
		});

		if (opacity <= 0) return;

		// Map blurIntensity (0–100) to pixel radius (0–30)
		const blurRadius = (this.params.blurIntensity / 100) * 30;
		if (blurRadius < 0.1) return;

		// Region size: scale relative to canvas dimensions
		// scale=1 → full canvas, scale=0.5 → half canvas
		// boxWidth narrows the width independently (default 1 = proportional)
		const boxWidth = this.params.boxWidth ?? 1;
		const boxHeight = this.params.boxHeight ?? 1;
		const regionWidth = renderer.width * transform.scale * boxWidth;
		const regionHeight = renderer.height * transform.scale * boxHeight;

		// Region center: position is offset from canvas center
		const centerX = renderer.width / 2 + transform.position.x;
		const centerY = renderer.height / 2 + transform.position.y;

		const regionX = centerX - regionWidth / 2;
		const regionY = centerY - regionHeight / 2;

		// Create offscreen canvas matching region size
		let offscreen: OffscreenCanvas | HTMLCanvasElement;
		let offscreenCtx:
			| OffscreenCanvasRenderingContext2D
			| CanvasRenderingContext2D;

		const regionW = Math.max(1, Math.round(regionWidth));
		const regionH = Math.max(1, Math.round(regionHeight));

		try {
			offscreen = new OffscreenCanvas(regionW, regionH);
			const octx = offscreen.getContext("2d");
			if (!octx) throw new Error("no 2d context");
			offscreenCtx = octx;
		} catch {
			offscreen = document.createElement("canvas");
			offscreen.width = regionW;
			offscreen.height = regionH;
			const octx = offscreen.getContext("2d");
			if (!octx) throw new Error("no 2d context");
			offscreenCtx = octx;
		}

		// Copy the current canvas region into the offscreen canvas
		offscreenCtx.drawImage(
			renderer.canvas as CanvasImageSource,
			Math.max(0, regionX),
			Math.max(0, regionY),
			regionWidth,
			regionHeight,
			0,
			0,
			regionW,
			regionH,
		);

		// Draw the blurred region back onto the main canvas
		ctx.save();
		ctx.globalAlpha = opacity;

		// Apply rotation around the region center
		if (transform.rotate !== 0) {
			ctx.translate(centerX, centerY);
			ctx.rotate((transform.rotate * Math.PI) / 180);
			ctx.translate(-centerX, -centerY);
		}

		ctx.filter = `blur(${blurRadius}px)`;
		ctx.drawImage(
			offscreen as CanvasImageSource,
			regionX,
			regionY,
			regionWidth,
			regionHeight,
		);
		ctx.restore();
	}
}
