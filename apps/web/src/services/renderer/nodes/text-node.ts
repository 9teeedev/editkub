import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import type { CaptionWordTiming, TextElement } from "@/types/timeline";
import { getTextScaleFactor } from "@/constants/text-constants";
import { canvasFontFamily } from "@/lib/canvas-fonts";
import { resolveAnimatedProperties } from "@/lib/timeline/keyframe-utils";
import { resolveTextAnimations } from "@/lib/timeline/text-animation-utils";

type RenderContext =
	| CanvasRenderingContext2D
	| OffscreenCanvasRenderingContext2D;

function scaleFontSize({
	fontSize,
	canvasWidth,
	canvasHeight,
}: {
	fontSize: number;
	canvasWidth: number;
	canvasHeight: number;
}): number {
	return fontSize * getTextScaleFactor({ canvasWidth, canvasHeight });
}

export function scaleBoxWidth({
	boxWidth,
	canvasWidth,
	canvasHeight,
}: {
	boxWidth: number;
	canvasWidth: number;
	canvasHeight: number;
}): number {
	return boxWidth * getTextScaleFactor({ canvasWidth, canvasHeight });
}

function wrapText({
	context,
	text,
	maxWidth,
}: {
	context: RenderContext;
	text: string;
	maxWidth: number;
}): string[] {
	const lines: string[] = [];
	const paragraphs = text.split("\n");

	for (const paragraph of paragraphs) {
		if (paragraph === "") {
			lines.push("");
			continue;
		}

		const chars = Array.from(paragraph);
		let currentLine = "";

		for (const char of chars) {
			const testLine = currentLine + char;
			const metrics = context.measureText(testLine);

			if (metrics.width > maxWidth && currentLine !== "") {
				lines.push(currentLine);
				currentLine = char;
			} else {
				currentLine = testLine;
			}
		}

		if (currentLine !== "") {
			lines.push(currentLine);
		}
	}

	return lines.length > 0 ? lines : [""];
}

export type TextNodeParams = TextElement & {
	canvasCenter: { x: number; y: number };
	canvasWidth: number;
	canvasHeight: number;
	textBaseline?: CanvasTextBaseline;
};

/** A word laid out on one line, with its measured width and x offset. */
export interface LaidOutWord {
	timing: CaptionWordTiming;
	/** Index of this word within the whole caption. */
	index: number;
	x: number;
	width: number;
}

export interface LaidOutLine {
	words: LaidOutWord[];
	width: number;
}

/** True when the text contains Thai characters (written without spaces). */
function isThaiText(text: string): boolean {
	return /[\u0E00-\u0E7F]/.test(text);
}

/**
 * Wrap caption words into lines. Words are never split; a line breaks
 * when the next word (plus separator) would exceed maxWidth. Thai words
 * are laid out without separators, everything else with a space.
 *
 * Exported so the preview selection overlay can measure caption elements
 * with the exact same layout the renderer draws.
 */
export function wrapCaptionWords({
	context,
	words,
	spaceWidth,
	maxWidth,
}: {
	context: RenderContext;
	words: CaptionWordTiming[];
	spaceWidth: number;
	maxWidth: number;
}): LaidOutLine[] {
	const lines: LaidOutLine[] = [];
	let current: LaidOutWord[] = [];
	let currentWidth = 0;

	words.forEach((timing, index) => {
		const width = context.measureText(timing.text).width;
		const previous = current[current.length - 1];
		const separator =
			previous === undefined
				? 0
				: isThaiText(previous.timing.text) && isThaiText(timing.text)
					? 0
					: spaceWidth;
		if (current.length > 0 && currentWidth + separator + width > maxWidth) {
			lines.push({ words: current, width: currentWidth });
			current = [];
			currentWidth = 0;
		}
		const x = currentWidth + (current.length === 0 ? 0 : separator);
		current.push({ timing, index, x, width });
		currentWidth = x + width;
	});

	if (current.length > 0) {
		lines.push({ words: current, width: currentWidth });
	}
	return lines.length > 0 ? lines : [{ words: [], width: 0 }];
}

/** Index of the word spoken at `localTime`; -1 before the first word. */
function activeWordIndex({
	words,
	localTime,
}: {
	words: CaptionWordTiming[];
	localTime: number;
}): number {
	let active = -1;
	for (let i = 0; i < words.length; i++) {
		if (localTime >= words[i].start) {
			active = i;
		} else {
			break;
		}
	}
	// Once the last word has started it stays highlighted until the
	// element ends, matching common karaoke caption behavior.
	return active;
}

export class TextNode extends BaseNode<TextNodeParams> {
	isInRange({ time }: { time: number }) {
		return (
			time >= this.params.startTime &&
			time < this.params.startTime + this.params.duration
		);
	}

	async render({ renderer, time }: { renderer: CanvasRenderer; time: number }) {
		if (!this.isInRange({ time })) {
			return;
		}

		renderer.context.save();

		// Resolve keyframe-animated transform/opacity for this frame. When the
		// element has keyframes, sample them at the element-local time.
		const localTime = time - this.params.startTime;
		const { transform, opacity } = resolveAnimatedProperties({
			keyframes: this.params.keyframes,
			time: localTime,
			baseTransform: this.params.transform,
			baseOpacity: this.params.opacity,
		});

		// Resolve per-frame text animation (typewriter, fade, slide, bounce, …).
		// Offset/scale/opacity compose with the keyframe values; visibleText may
		// be truncated (typewriter).
		const textAnim = resolveTextAnimations({
			animations: this.params.textAnimations,
			localTime,
			elementDuration: this.params.duration,
			fullText: this.params.content,
			baseScale: transform.scale,
		});
		const effectiveContent = textAnim.visibleText || this.params.content;

		const x = transform.position.x + this.params.canvasCenter.x;
		const y = transform.position.y + this.params.canvasCenter.y;

		renderer.context.translate(x + textAnim.offsetX, y + textAnim.offsetY);
		if (transform.rotate) {
			renderer.context.rotate((transform.rotate * Math.PI) / 180);
		}
		const effectiveScale = transform.scale * textAnim.scale;
		if (effectiveScale !== 1) {
			renderer.context.scale(effectiveScale, effectiveScale);
		}

		const fontWeight = this.params.fontWeight === "bold" ? "bold" : "normal";
		const fontStyle = this.params.fontStyle === "italic" ? "italic" : "normal";
		const textBaseline = this.params.textBaseline || "middle";
		const scaledFontSize = scaleFontSize({
			fontSize: this.params.fontSize,
			canvasWidth: this.params.canvasWidth,
			canvasHeight: this.params.canvasHeight,
		});
		renderer.context.font = `${fontStyle} ${fontWeight} ${scaledFontSize}px ${canvasFontFamily(this.params.fontFamily)}`;
		renderer.context.textAlign = this.params.textAlign;
		renderer.context.textBaseline = textBaseline;
		renderer.context.fillStyle = this.params.color;

		const prevAlpha = renderer.context.globalAlpha;
		renderer.context.globalAlpha = opacity * textAnim.opacity;

		const boxWidth = this.params.boxWidth;
		const hasBoxWidth = boxWidth !== undefined && boxWidth > 0;
		const scaledBoxWidth = hasBoxWidth
			? scaleBoxWidth({
					boxWidth,
					canvasWidth: this.params.canvasWidth,
					canvasHeight: this.params.canvasHeight,
				})
			: 0;

		if (this.params.wordTimings && this.params.wordTimings.length > 0) {
			this.renderCaptionWords({
				context: renderer.context,
				scaledFontSize,
				localTime,
				textBaseline,
			});
		} else if (hasBoxWidth) {
			this.renderMultiline({
				context: renderer.context,
				scaledFontSize,
			scaledBoxWidth,
			textBaseline,
			contentOverride: effectiveContent,
		});
	} else {
			this.renderSingleLine({
				context: renderer.context,
			scaledFontSize,
			textBaseline,
			contentOverride: effectiveContent,
		});
	}

		renderer.context.globalAlpha = prevAlpha;
		renderer.context.restore();
	}

	/**
	 * Karaoke caption rendering: draws each word separately so the word
	 * being spoken can be highlighted. Used when the element carries
	 * `wordTimings` (derived captions); otherwise the plain single/multi
	 * line paths are used.
	 */
	private renderCaptionWords({
		context,
		scaledFontSize,
		localTime,
		textBaseline,
	}: {
		context: RenderContext;
		scaledFontSize: number;
		localTime: number;
		textBaseline: CanvasTextBaseline;
	}) {
		const words = this.params.wordTimings ?? [];
		const captionStyle = this.params.captionStyle;
		const spaceWidth = context.measureText(" ").width;
		// Wrap at the element's box width when set (derived captions set it
		// to match their selection bounds); otherwise 80% of the canvas.
		const hasBoxWidth =
			this.params.boxWidth !== undefined && this.params.boxWidth > 0;
		const maxWidth = hasBoxWidth
			? scaleBoxWidth({
					boxWidth: this.params.boxWidth as number,
					canvasWidth: this.params.canvasWidth,
					canvasHeight: this.params.canvasHeight,
				})
			: this.params.canvasWidth * 0.8;

		const lines = wrapCaptionWords({
			context,
			words,
			spaceWidth,
			maxWidth,
		});

		const lineHeight = scaledFontSize * 1.3;
		const totalHeight = lines.length * lineHeight;
		const startY =
			textBaseline === "bottom" ? -totalHeight : -totalHeight / 2;

		context.textBaseline = "middle";

		const active = activeWordIndex({ words, localTime });

		lines.forEach((line, lineIndex) => {
			const lineY = startY + lineIndex * lineHeight + lineHeight / 2;

		// drawCaptionLineWords draws left-aligned from lineX, so center the
		// line on the origin; left/right align against the wrap box instead.
		let lineX = -line.width / 2;
		if (this.params.textAlign === "left") lineX = -maxWidth / 2;
		else if (this.params.textAlign === "right") lineX = maxWidth / 2 - line.width;

			this.drawCaptionLineBackground({ context, line, lineX, lineY, lineHeight, scaledFontSize });
			this.drawCaptionLineWords({
				context,
				line,
				lineX,
				lineY,
				lineHeight,
				scaledFontSize,
				active,
				localTime,
				captionStyle: this.params.captionStyle,
			});
		});
	}

	private drawCaptionLineBackground({
		context,
		line,
		lineX,
		lineY,
		lineHeight,
		scaledFontSize,
	}: {
		context: RenderContext;
		line: LaidOutLine;
		lineX: number;
		lineY: number;
		lineHeight: number;
		scaledFontSize: number;
	}) {
		if (
			!this.params.backgroundColor ||
			this.params.backgroundColor === "transparent" ||
			line.words.length === 0
		) {
			return;
		}

		const padX = this.params.backgroundPaddingX ?? 8;
		const padY = this.params.backgroundPaddingY ?? 4;
		const borderRadius = this.params.backgroundBorderRadius ?? 0;

		const prevAlpha = context.globalAlpha;
		context.globalAlpha = prevAlpha * (this.params.backgroundOpacity ?? 1);
		context.fillStyle = this.params.backgroundColor;

		const bgX = lineX - padX;
		const bgY = lineY - lineHeight / 2 - padY;
		const bgW = line.width + padX * 2;
		const bgH = Math.max(lineHeight, scaledFontSize) + padY * 2;

		if (borderRadius > 0 && context.roundRect) {
			context.beginPath();
			context.roundRect(bgX, bgY, bgW, bgH, borderRadius);
			context.fill();
		} else {
			context.fillRect(bgX, bgY, bgW, bgH);
		}

		context.globalAlpha = prevAlpha;
	}

	private drawCaptionLineWords({
		context,
		line,
		lineX,
		lineY,
		lineHeight,
		scaledFontSize,
		active,
		localTime,
		captionStyle,
	}: {
		context: RenderContext;
		line: LaidOutLine;
		lineX: number;
		lineY: number;
		lineHeight: number;
		scaledFontSize: number;
		active: number;
		localTime: number;
		captionStyle: TextElement["captionStyle"];
	}) {
		const accent = captionStyle?.accentColor ?? "#f97316";
		const flow = captionStyle?.flow ?? "color";
		const stroke = this.params.stroke;
		const metrics = context.measureText("Mg");
		const ascent = metrics.actualBoundingBoxAscent ?? scaledFontSize * 0.8;
		const descent = metrics.actualBoundingBoxDescent ?? scaledFontSize * 0.2;

		const prevAlign = context.textAlign;
		context.textAlign = "left";

		for (const laid of line.words) {
			const wordX = lineX + laid.x;
			const isActive = laid.index === active;
			const timing = laid.timing;
			const progress =
				isActive && timing.end > timing.start
					? Math.min(
							1,
							Math.max(0, (localTime - timing.start) / (timing.end - timing.start)),
						)
					: 0;

			// Outline first (with shadow, like the plain paths), then fill.
			if (stroke && stroke.width > 0) {
				if (this.params.shadow) {
					context.shadowColor = this.params.shadow.color;
					context.shadowOffsetX = this.params.shadow.offsetX;
					context.shadowOffsetY = this.params.shadow.offsetY;
					context.shadowBlur = this.params.shadow.blur;
				}
				context.strokeStyle = stroke.color;
				context.lineWidth = stroke.width * 2;
				context.lineJoin = "round";
				context.strokeText(timing.text, wordX, lineY);
				if (this.params.shadow) {
					context.shadowColor = "transparent";
					context.shadowBlur = 0;
					context.shadowOffsetX = 0;
					context.shadowOffsetY = 0;
				}
			}

			if (!isActive || flow === "box") {
				context.fillStyle = this.params.color;
				context.fillText(timing.text, wordX, lineY);
			}

			if (!isActive) continue;

			if (flow === "color") {
				context.fillStyle = accent;
				context.fillText(timing.text, wordX, lineY);
			} else if (flow === "box") {
				const pad = scaledFontSize * 0.1;
				context.strokeStyle = accent;
				context.lineWidth = Math.max(2, scaledFontSize * 0.05);
				context.strokeRect(
					wordX - pad,
					lineY - ascent - pad * 0.5,
					laid.width + pad * 2,
					ascent + descent + pad,
				);
			} else if (flow === "block") {
				const pad = scaledFontSize * 0.12;
				const prevAlpha = context.globalAlpha;
				context.globalAlpha = prevAlpha * 0.9;
				context.fillStyle = accent;
				if (context.roundRect) {
					context.beginPath();
					context.roundRect(
						wordX - pad,
						lineY - ascent - pad * 0.6,
						laid.width + pad * 2,
						ascent + descent + pad * 1.2,
						scaledFontSize * 0.15,
					);
					context.fill();
				} else {
					context.fillRect(
						wordX - pad,
						lineY - lineHeight / 2,
						laid.width + pad * 2,
						lineHeight,
					);
				}
				context.globalAlpha = prevAlpha;
				context.fillStyle = this.params.color;
				context.fillText(timing.text, wordX, lineY);
			} else if (flow === "fill") {
				context.save();
				context.beginPath();
				context.rect(wordX, lineY - lineHeight, laid.width * progress, lineHeight * 2);
				context.clip();
				context.fillStyle = accent;
				context.fillText(timing.text, wordX, lineY);
				context.restore();
			} else if (flow === "pop") {
				context.save();
				context.translate(wordX + laid.width / 2, lineY);
				context.scale(1.12, 1.12);
				context.translate(-(wordX + laid.width / 2), -lineY);
				context.fillStyle = accent;
				context.fillText(timing.text, wordX, lineY);
				context.restore();
			}
		}

		context.textAlign = prevAlign;
	}

	private renderSingleLine({
		context,
		scaledFontSize,
		textBaseline,
		contentOverride,
	}: {
		context: RenderContext;
		scaledFontSize: number;
		textBaseline: CanvasTextBaseline;
		contentOverride?: string;
	}) {
		const content = contentOverride ?? this.params.content;
		if (this.params.backgroundColor && this.params.backgroundColor !== "transparent") {
			const metrics = context.measureText(content);
			const ascent = metrics.actualBoundingBoxAscent ?? scaledFontSize * 0.8;
			const descent =
				metrics.actualBoundingBoxDescent ?? scaledFontSize * 0.2;
			const textW = metrics.width;
			const textH = ascent + descent;
			const padX = this.params.backgroundPaddingX ?? 8;
			const padY = this.params.backgroundPaddingY ?? 4;
			const borderRadius = this.params.backgroundBorderRadius ?? 0;

			const prevAlpha = context.globalAlpha;
			const bgOpacity = this.params.backgroundOpacity ?? 1;
			context.globalAlpha = prevAlpha * bgOpacity;

			context.fillStyle = this.params.backgroundColor;
			let bgLeft = -textW / 2;
			if (context.textAlign === "left") bgLeft = 0;
			if (context.textAlign === "right") bgLeft = -textW;

			const backgroundTop =
				textBaseline === "bottom" ? -textH - padY : -textH / 2 - padY;
			const bgW = textW + padX * 2;
			const bgH = textH + padY * 2;
			const bgX = bgLeft - padX;

			if (borderRadius > 0 && context.roundRect) {
				context.beginPath();
				context.roundRect(bgX, backgroundTop, bgW, bgH, borderRadius);
				context.fill();
			} else {
				context.fillRect(bgX, backgroundTop, bgW, bgH);
			}

			context.globalAlpha = prevAlpha;
			context.fillStyle = this.params.color;
		}

		if (this.params.shadow) {
			context.shadowColor = this.params.shadow.color;
			context.shadowOffsetX = this.params.shadow.offsetX;
			context.shadowOffsetY = this.params.shadow.offsetY;
			context.shadowBlur = this.params.shadow.blur;
		}

		if (this.params.stroke && this.params.stroke.width > 0) {
			context.strokeStyle = this.params.stroke.color;
			context.lineWidth = this.params.stroke.width * 2;
			context.lineJoin = "round";
			context.strokeText(content, 0, 0);
		}

		if (this.params.shadow) {
			context.shadowColor = "transparent";
			context.shadowBlur = 0;
			context.shadowOffsetX = 0;
			context.shadowOffsetY = 0;
		}

		context.fillText(content, 0, 0);
	}

	private renderMultiline({
		context,
		scaledFontSize,
		scaledBoxWidth,
		textBaseline,
		contentOverride,
	}: {
		context: RenderContext;
		scaledFontSize: number;
		scaledBoxWidth: number;
		textBaseline: CanvasTextBaseline;
		contentOverride?: string;
	}) {
		const content = contentOverride ?? this.params.content;
		const lines = wrapText({
			context,
			text: content,
			maxWidth: scaledBoxWidth,
		});

		const lineHeight = scaledFontSize * 1.3;
		const totalHeight = lines.length * lineHeight;

		let startY: number;
		if (textBaseline === "bottom") {
			startY = -totalHeight;
		} else {
			startY = -totalHeight / 2 + lineHeight / 2;
		}

		context.textBaseline = "middle";

		let textX = 0;
		if (context.textAlign === "left") {
			textX = -scaledBoxWidth / 2;
		} else if (context.textAlign === "right") {
			textX = scaledBoxWidth / 2;
		}

		if (this.params.backgroundColor && this.params.backgroundColor !== "transparent") {
			const padX = this.params.backgroundPaddingX ?? 8;
			const padY = this.params.backgroundPaddingY ?? 4;
			const borderRadius = this.params.backgroundBorderRadius ?? 0;

			const prevAlpha = context.globalAlpha;
			const bgOpacity = this.params.backgroundOpacity ?? 1;
			context.globalAlpha = prevAlpha * bgOpacity;

			context.fillStyle = this.params.backgroundColor;
			const bgX = -scaledBoxWidth / 2 - padX;
			const bgY = startY - lineHeight / 2 - padY;
			const bgW = scaledBoxWidth + padX * 2;
			const bgH = totalHeight + padY * 2;

			if (borderRadius > 0 && context.roundRect) {
				context.beginPath();
				context.roundRect(bgX, bgY, bgW, bgH, borderRadius);
				context.fill();
			} else {
				context.fillRect(bgX, bgY, bgW, bgH);
			}

			context.globalAlpha = prevAlpha;
			context.fillStyle = this.params.color;
		}

		for (let i = 0; i < lines.length; i++) {
			const lineY = startY + i * lineHeight;

			if (this.params.shadow) {
				context.shadowColor = this.params.shadow.color;
				context.shadowOffsetX = this.params.shadow.offsetX;
				context.shadowOffsetY = this.params.shadow.offsetY;
				context.shadowBlur = this.params.shadow.blur;
			}

			if (this.params.stroke && this.params.stroke.width > 0) {
				context.strokeStyle = this.params.stroke.color;
				context.lineWidth = this.params.stroke.width * 2;
				context.lineJoin = "round";
				context.strokeText(lines[i], textX, lineY);
			}

			if (this.params.shadow) {
				context.shadowColor = "transparent";
				context.shadowBlur = 0;
				context.shadowOffsetX = 0;
				context.shadowOffsetY = 0;
			}

			context.fillText(lines[i], textX, lineY);
		}
	}
}
