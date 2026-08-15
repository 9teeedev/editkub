import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import type {
	ChromaKeyConfig,
	BackgroundRemovalConfig,
	ElementKeyframes,
	PictureInPictureConfig,
	ShapeMaskConfig,
	Transform,
	VideoEffectConfig,
} from "@/types/timeline";
import { resolveAnimatedProperties } from "@/lib/timeline/keyframe-utils";
import {
	applyChromaKey,
	ensureChromaTarget,
	type DrawableCanvas,
} from "@/lib/renderer/chroma-key";
import { applyVideoEffect } from "@/lib/renderer/video-effects";
import { applyShapeMask } from "@/lib/renderer/shape-mask";
import {
	applyBackgroundRemoval,
	reportBackgroundRemovalError,
} from "@/lib/renderer/background-removal";

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
	blendMode?: string;
	chromaKey?: ChromaKeyConfig;
	videoEffect?: VideoEffectConfig;
	shapeMask?: ShapeMaskConfig;
	backgroundRemoval?: BackgroundRemovalConfig;
	pip?: PictureInPictureConfig;
	keyframes?: ElementKeyframes;
	playbackRate?: number;
	reversed?: boolean;
}

export abstract class VisualNode<
	Params extends VisualNodeParams = VisualNodeParams,
> extends BaseNode<Params> {
	private chromaTarget?: DrawableCanvas;
	private vfxTarget?: DrawableCanvas;
	private shapeMaskTarget?: DrawableCanvas;
	private backgroundRemovalTarget?: DrawableCanvas;

	protected async getMaskedSource({
		source,
		sourceWidth,
		sourceHeight,
	}: {
		source: CanvasImageSource;
		sourceWidth: number;
		sourceHeight: number;
	}): Promise<{
		source: CanvasImageSource;
		sourceWidth: number;
		sourceHeight: number;
	}> {
		let currentSource: CanvasImageSource = source;

		if (this.params.backgroundRemoval?.enabled) {
			this.backgroundRemovalTarget = ensureChromaTarget({
				existing: this.backgroundRemovalTarget,
				width: sourceWidth,
				height: sourceHeight,
			});
			try {
				await applyBackgroundRemoval({
					source: currentSource,
					sourceWidth,
					sourceHeight,
					config: this.params.backgroundRemoval,
					target: this.backgroundRemovalTarget,
				});
				currentSource = this.backgroundRemovalTarget;
			} catch (error) {
				reportBackgroundRemovalError();
				console.warn("Background removal failed; using original frame:", error);
			}
		}

		if (this.params.chromaKey) {
			this.chromaTarget = ensureChromaTarget({
				existing: this.chromaTarget,
				width: sourceWidth,
				height: sourceHeight,
			});
			applyChromaKey({
				source: currentSource,
				sourceWidth,
				sourceHeight,
				config: this.params.chromaKey,
				target: this.chromaTarget,
			});
			currentSource = this.chromaTarget;
		}

		if (
			this.params.videoEffect &&
			this.params.videoEffect.effect !== "none" &&
			this.params.videoEffect.intensity > 0
		) {
			this.vfxTarget = ensureChromaTarget({
				existing: this.vfxTarget,
				width: sourceWidth,
				height: sourceHeight,
			});
			applyVideoEffect({
				source: currentSource,
				sourceWidth,
				sourceHeight,
				config: this.params.videoEffect,
				target: this.vfxTarget,
			});
			currentSource = this.vfxTarget;
		}

		if (this.params.shapeMask) {
			this.shapeMaskTarget = ensureChromaTarget({
				existing: this.shapeMaskTarget,
				width: sourceWidth,
				height: sourceHeight,
			});
			applyShapeMask({
				source: currentSource,
				sourceWidth,
				sourceHeight,
				config: this.params.shapeMask,
				target: this.shapeMaskTarget,
			});
			currentSource = this.shapeMaskTarget;
		}

		return { source: currentSource, sourceWidth, sourceHeight };
	}

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
		time,
	}: {
		renderer: CanvasRenderer;
		source: CanvasImageSource;
		sourceWidth: number;
		sourceHeight: number;
		time: number;
	}): void {
		renderer.context.save();

		if (this.params.blendMode) {
			renderer.context.globalCompositeOperation = this.params
				.blendMode as GlobalCompositeOperation;
		}

		if (this.params.filter && this.params.filter !== "none") {
			renderer.context.filter = this.params.filter;
		}

		// Resolve the effective transform/opacity for this frame. When the
		// element has keyframes, sample them at the element-local time;
		// otherwise use the static base values. `time` here is absolute
		// (timeline time), and keyframes are stored relative to `timeOffset`.
		const localTime = time - this.params.timeOffset;
		const { transform, opacity } = resolveAnimatedProperties({
			keyframes: this.params.keyframes,
			time: localTime,
			baseTransform: this.params.transform,
			baseOpacity: this.params.opacity,
		});
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

		const pip = this.params.pip;
		const drawPipPath = () => {
			const radius = Math.min(
				pip?.borderRadius ?? 0,
				scaledWidth / 2,
				scaledHeight / 2,
			);
			renderer.context.beginPath();
			renderer.context.moveTo(x + radius, y);
			renderer.context.arcTo(
				x + scaledWidth,
				y,
				x + scaledWidth,
				y + scaledHeight,
				radius,
			);
			renderer.context.arcTo(
				x + scaledWidth,
				y + scaledHeight,
				x,
				y + scaledHeight,
				radius,
			);
			renderer.context.arcTo(x, y + scaledHeight, x, y, radius);
			renderer.context.arcTo(x, y, x + scaledWidth, y, radius);
			renderer.context.closePath();
		};

		if (pip) {
			renderer.context.save();
			if (pip.shadow) {
				renderer.context.shadowColor = "rgba(0, 0, 0, 0.35)";
				renderer.context.shadowBlur = 18;
				renderer.context.shadowOffsetY = 6;
				drawPipPath();
				renderer.context.strokeStyle = "rgba(0, 0, 0, 0.35)";
				renderer.context.lineWidth = Math.max(2, pip.borderWidth);
				renderer.context.stroke();
			}
			renderer.context.shadowColor = "transparent";
			drawPipPath();
			renderer.context.clip();
		}

		renderer.context.drawImage(source, x, y, scaledWidth, scaledHeight);

		if (pip) {
			renderer.context.restore();
			if (pip.borderWidth > 0) {
				renderer.context.save();
				drawPipPath();
				renderer.context.strokeStyle = pip.borderColor;
				renderer.context.lineWidth = pip.borderWidth;
				renderer.context.stroke();
				renderer.context.restore();
			}
		}

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
