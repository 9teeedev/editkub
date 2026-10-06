import type { CanvasRenderer } from "../canvas-renderer";
import type { AdjustmentControls } from "@/types/timeline";
import { BaseNode } from "./base-node";
import { computeFilterString } from "../filter-string";

/** One adjustment element's active window on an adjustment track. */
export interface AdjustmentLayerSpan {
	adjustments: AdjustmentControls;
	startTime: number;
	duration: number;
}

export type AdjustmentLayerNodeParams = {
	spans: AdjustmentLayerSpan[];
	contentNodes: BaseNode[];
};

/**
 * Full-canvas color pass for adjustment layers. Renders its content nodes
 * (everything the scene builder collected from tracks below) to an offscreen
 * canvas, then composites it back through the active span's CSS filter plus
 * a full-frame vignette. Outside every span it renders the content untouched,
 * so an adjustment track with no element at the current time costs nothing.
 *
 * Stacking works like PSD adjustment layers: a higher adjustment track wraps
 * this node inside its own content, so its filter applies on top of this one.
 */
export class AdjustmentLayerNode extends BaseNode<AdjustmentLayerNodeParams> {
	/**
	 * Reused across frames (TransitionNode pattern) — allocating a full-size
	 * canvas per frame thrashes GC across a long export. Cleared before each
	 * use because content nodes may not cover every pixel.
	 */
	private offscreen?: OffscreenCanvas | HTMLCanvasElement;

	private ensureOffscreen({
		width,
		height,
	}: {
		width: number;
		height: number;
	}): {
		canvas: OffscreenCanvas | HTMLCanvasElement;
		context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
	} {
		let canvas = this.offscreen;
		if (!canvas || canvas.width !== width || canvas.height !== height) {
			try {
				canvas = new OffscreenCanvas(width, height);
			} catch {
				const fallback = document.createElement("canvas");
				fallback.width = width;
				fallback.height = height;
				canvas = fallback;
			}
			this.offscreen = canvas;
		}
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			throw new Error("failed to get offscreen canvas context");
		}
		ctx.clearRect(0, 0, width, height);
		return { canvas, context: ctx };
	}

	async render({
		renderer,
		time,
	}: {
		renderer: CanvasRenderer;
		time: number;
	}): Promise<void> {
		const active = this.params.spans.find(
			(span) =>
				time >= span.startTime && time < span.startTime + span.duration,
		);

		if (!active) {
			for (const node of this.params.contentNodes) {
				await node.render({ renderer, time });
			}
			return;
		}

		const { canvas: offscreen, context: offscreenCtx } = this.ensureOffscreen({
			width: renderer.width,
			height: renderer.height,
		});

		const originalContext = renderer.context;
		renderer.context = offscreenCtx;
		try {
			for (const node of this.params.contentNodes) {
				await node.render({ renderer, time });
			}
		} finally {
			renderer.context = originalContext;
		}

		const { adjustments } = active;
		const filter = computeFilterString(undefined, adjustments);
		const isNeutralFilter = filter === "none";

		renderer.context.save();
		if (!isNeutralFilter) {
			renderer.context.filter = filter;
		}
		renderer.context.drawImage(offscreen as CanvasImageSource, 0, 0);
		renderer.context.restore();

		// Full-frame vignette (same geometry as the per-clip variant in
		// visual-node, scaled to the whole canvas).
		const vignette = adjustments.vignette ?? 0;
		if (vignette > 0) {
			const intensity = Math.min(Math.max(vignette / 100, 0), 1);
			const inner = Math.min(renderer.width, renderer.height) * 0.32;
			const outer = Math.max(renderer.width, renderer.height) * 0.72;
			const grad = renderer.context.createRadialGradient(
				renderer.width / 2,
				renderer.height / 2,
				inner,
				renderer.width / 2,
				renderer.height / 2,
				outer,
			);
			grad.addColorStop(0, "rgba(0,0,0,0)");
			grad.addColorStop(1, `rgba(0,0,0,${(intensity * 0.85).toFixed(3)})`);
			renderer.context.save();
			renderer.context.fillStyle = grad;
			renderer.context.fillRect(0, 0, renderer.width, renderer.height);
			renderer.context.restore();
		}
	}
}
