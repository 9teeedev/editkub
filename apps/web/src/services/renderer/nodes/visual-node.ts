import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import type { Transform } from "@/types/timeline";

const VISUAL_EPSILON = 1 / 1000;

export interface VisualNodeParams {
	duration: number;
	timeOffset: number;
	trimStart: number;
	trimEnd: number;
	transform: Transform;
	opacity: number;
	filter?: string;
	vignette?: number; // 0-100, edge darkening intensity
	playbackRate?: number;
	reversed?: boolean;
}

export abstract class VisualNode<
	Params extends VisualNodeParams = VisualNodeParams,
> extends BaseNode<Params> {
	protected getLocalTime(time: number): number {
		const rate = this.params.playbackRate ?? 1;
		const elapsed = time - this.params.timeOffset;
		if (this.params.reversed) {
			return this.params.trimStart + rate * (this.params.duration - elapsed);
		}
		return this.params.trimStart + elapsed * rate;
	}

	protected isInRange(time: number): boolean {
		const localTime = this.getLocalTime(time);
		const rate = this.params.playbackRate ?? 1;
		return (
			localTime >= this.params.trimStart - VISUAL_EPSILON &&
			localTime < this.params.trimStart + this.params.duration * rate
		);
	}

	protected renderVisual({
		renderer,
		source,
		sourceWidth,
		sourceHeight,
	}: {
		renderer: CanvasRenderer;
		source: CanvasImageSource;
		sourceWidth: number;
		sourceHeight: number;
	}): void {
		renderer.context.save();

		if (this.params.filter && this.params.filter !== "none") {
			renderer.context.filter = this.params.filter;
		}

		const { transform, opacity } = this.params;
		const containScale = Math.min(
			renderer.width / sourceWidth,
			renderer.height / sourceHeight,
		);
		const scaledWidth = sourceWidth * containScale * transform.scale;
		const scaledHeight = sourceHeight * containScale * transform.scale;
		const x = renderer.width / 2 + transform.position.x - scaledWidth / 2;
		const y = renderer.height / 2 + transform.position.y - scaledHeight / 2;

		renderer.context.globalAlpha = opacity;

		const centerX = x + scaledWidth / 2;
		const centerY = y + scaledHeight / 2;

		const needsFlip = transform.flipX || transform.flipY;
		const needsRotate = transform.rotate !== 0;

		if (needsRotate || needsFlip) {
			renderer.context.translate(centerX, centerY);
			if (needsRotate) {
				renderer.context.rotate((transform.rotate * Math.PI) / 180);
			}
			if (needsFlip) {
				renderer.context.scale(
					transform.flipX ? -1 : 1,
					transform.flipY ? -1 : 1,
				);
			}
			renderer.context.translate(-centerX, -centerY);
		}

		renderer.context.drawImage(source, x, y, scaledWidth, scaledHeight);

		// Vignette: radial gradient darkened at the edges, clipped to the clip rect.
		// Drawn before restore() so it composites inside the same transform/alpha scope.
		const vignette = this.params.vignette ?? 0;
		if (vignette > 0) {
			const intensity = Math.min(Math.max(vignette / 100, 0), 1);
			const inner = Math.min(scaledWidth, scaledHeight) * 0.32;
			const outer = Math.max(scaledWidth, scaledHeight) * 0.72;
			const grad = renderer.context.createRadialGradient(
				centerX,
				centerY,
				inner,
				centerX,
				centerY,
				outer,
			);
			grad.addColorStop(0, "rgba(0,0,0,0)");
			grad.addColorStop(1, `rgba(0,0,0,${(intensity * 0.85).toFixed(3)})`);
			renderer.context.save();
			renderer.context.beginPath();
			renderer.context.rect(x, y, scaledWidth, scaledHeight);
			renderer.context.clip();
			renderer.context.fillStyle = grad;
			renderer.context.fillRect(x, y, scaledWidth, scaledHeight);
			renderer.context.restore();
		}

		renderer.context.restore();
	}
}
