import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";

export type BlurBackgroundNodeParams = {
	blurIntensity: number;
	contentNodes: BaseNode[];
};

export class BlurBackgroundNode extends BaseNode<BlurBackgroundNodeParams> {
	private blurIntensity: number;
	private contentNodes: BaseNode[];

	/**
	 * Reused across frames (TransitionNode pattern) — allocating a full-size
	 * canvas per frame thrashes GC across a long export. Cleared before each
	 * use because content nodes may not cover every pixel.
	 */
	private offscreen?: OffscreenCanvas | HTMLCanvasElement;

	constructor(params: BlurBackgroundNodeParams) {
		super(params);
		this.blurIntensity = params.blurIntensity;
		this.contentNodes = params.contentNodes;
	}

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
		const {
			canvas: offscreen,
			context: offscreenCtx,
		} = this.ensureOffscreen({
			width: renderer.width,
			height: renderer.height,
		});

		const originalContext = renderer.context;
		renderer.context = offscreenCtx;

		for (const node of this.contentNodes) {
			await node.render({ renderer, time });
		}

		renderer.context = originalContext;

		const zoomScale = 1.4;
		const scaledWidth = renderer.width * zoomScale;
		const scaledHeight = renderer.height * zoomScale;
		const offsetX = (renderer.width - scaledWidth) / 2;
		const offsetY = (renderer.height - scaledHeight) / 2;

		renderer.context.save();
		renderer.context.filter = `blur(${this.blurIntensity}px)`;
		renderer.context.drawImage(
			offscreen as CanvasImageSource,
			offsetX,
			offsetY,
			scaledWidth,
			scaledHeight,
		);
		renderer.context.restore();
	}
}
