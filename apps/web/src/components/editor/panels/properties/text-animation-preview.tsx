"use client";

import { useEffect, useMemo, useRef } from "react";
import { resolveTextAnimation } from "@/lib/timeline/text-animation-utils";
import type { TextAnimationPhase, TextAnimationType } from "@/types/timeline";

interface TextAnimationPreviewProps {
	/** Animation preset to preview. */
	type: TextAnimationType;
	/**
	 * Which phase the card belongs to. In-phase cards preview an entrance
	 * (text appears); out-phase cards preview an exit (text leaves). The type
	 * itself determines the direction, so this only documents intent for the
	 * caller — it does not change the draw math.
	 */
	phase: TextAnimationPhase;
	/** Whether the card is currently hovered (drives the animation loop). */
	isHovering: boolean;
	/** Sample text to render. Falls back to a placeholder when empty. */
	sampleText?: string;
}

/**
 * Mini canvas that previews a single text-animation preset. Idle (no hover)
 * draws the full text statically; on hover it runs a `requestAnimationFrame`
 * loop calling the real `resolveTextAnimation` resolver so the preview matches
 * the export/renderer output exactly.
 *
 * Mirrors the draw composition in `text-node.ts` (translate + offset, scale
 * multiply, opacity multiply, fillText with visibleText).
 */
export function TextAnimationPreview({
	type,
	phase: _phase,
	isHovering,
	sampleText,
}: TextAnimationPreviewProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const rafRef = useRef<number>(0);

	// Detect reduced-motion once — freeze at mid-progress so the effect is
	// still legible without motion.
	const reducedMotion = useMemo(
		() =>
			typeof window !== "undefined" &&
			window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
		[],
	);

	const fullText = sampleText?.trim() || "Editkub";

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		const CSS_W = canvas.clientWidth;
		const CSS_H = canvas.clientHeight;
		if (CSS_W === 0 || CSS_H === 0) return;
		canvas.width = CSS_W * dpr;
		canvas.height = CSS_H * dpr;
		ctx.scale(dpr, dpr);

		const W = CSS_W;
		const H = CSS_H;

		// Animation config used purely for the preview loop. A 1.6s window gives
		// entrance/exit effects a readable cadence; loops ignore duration.
		const PREVIEW_DURATION = 1.6;

		// Draw the text centered. `localTime` is the element-local time (seconds)
		// passed to the resolver; pass `null` to draw plain static text with no
		// animation applied (used for the idle/rest frame).
		const drawFrame = (localTime: number | null) => {
			ctx.clearRect(0, 0, W, H);
			ctx.save();

			let offsetX = 0;
			let offsetY = 0;
			let scale = 1;
			let opacity = 1;
			let content = fullText;

			if (localTime !== null) {
				const textAnim = resolveTextAnimation({
					animation: { type, duration: PREVIEW_DURATION, intensity: 1 },
					localTime,
					fullText,
					baseScale: 1,
				});
				offsetX = textAnim.offsetX;
				offsetY = textAnim.offsetY;
				scale = textAnim.scale;
				opacity = textAnim.opacity;
				content = textAnim.visibleText || fullText;
			}

			// Center the text, then apply the animation offset.
			ctx.translate(W / 2 + offsetX, H / 2 + offsetY);
			if (scale !== 1) {
				ctx.scale(scale, scale);
			}

			// Fit the font to the card height so longer sample text stays readable.
			const fontSize = Math.max(10, H * 0.42);
			ctx.font = `600 ${fontSize}px Arial, sans-serif`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillStyle = "#ffffff";
			ctx.globalAlpha = opacity;

			ctx.fillText(content, 0, 0);
			ctx.restore();
		};

		let cancelled = false;

		// Idle (no hover): draw the plain static text — same rest state for every
		// type, so exit effects like fade-out/slide-out don't render as a blank
		// "already gone" frame.
		// Reduced motion: freeze at mid-progress so the effect is still legible.
		if (!isHovering) {
			drawFrame(null);
			return () => {
				cancelled = true;
			};
		}
		if (reducedMotion) {
			drawFrame(PREVIEW_DURATION / 2);
			return () => {
				cancelled = true;
			};
		}

		// Hover loop. Entrance/exit effects run 0→PREVIEW_DURATION then hold a
		// beat before restarting; loops (bounce/glitch) advance localTime
		// forever so they stay in motion.
		const isLoop = type === "bounce" || type === "glitch";
		const HOLD_MS = 500;
		let start = 0;
		let phaseStart = 0;

		const tick = (t: number) => {
			if (cancelled) return;
			if (!start) {
				start = t;
				phaseStart = t;
			}

			if (isLoop) {
				// Loops: advance localTime indefinitely (resolver loops internally).
				drawFrame((t - start) / 1000);
				rafRef.current = requestAnimationFrame(tick);
				return;
			}

			// One-shot: play 0→PREVIEW_DURATION, then hold, then restart.
			const elapsed = (t - phaseStart) / 1000;
			if (elapsed >= PREVIEW_DURATION) {
				// Hold the end frame for HOLD_MS, then restart from 0.
				drawFrame(PREVIEW_DURATION);
				if (t - phaseStart >= (PREVIEW_DURATION + HOLD_MS / 1000) * 1000) {
					phaseStart = t;
				}
			} else {
				drawFrame(elapsed);
			}
			rafRef.current = requestAnimationFrame(tick);
		};
		rafRef.current = requestAnimationFrame(tick);

		return () => {
			cancelled = true;
			cancelAnimationFrame(rafRef.current);
		};
	}, [type, isHovering, reducedMotion, fullText]);

	return <canvas ref={canvasRef} className="h-14 w-full rounded" />;
}
