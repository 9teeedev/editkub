/**
 * Text animation resolver.
 *
 * Pure domain logic (per AGENTS.md → lives in `lib/`). Given a text element's
 * animation config and the element-local time, this module computes the
 * per-frame render state (visible text, opacity, offset, scale) that the
 * TextNode applies before drawing.
 *
 * Like keyframes, `localTime` is seconds from the element's start.
 */
import type {
	TextAnimation,
	TextAnimationPhase,
	TextAnimations,
	TextAnimationType,
} from "@/types/timeline";

export interface ResolvedTextAnimation {
	/** Text that should actually be drawn (typewriter truncates to this). */
	visibleText: string;
	/** Opacity multiplier in [0,1] applied on top of the element's base opacity. */
	opacity: number;
	/** Pixel-space offset added to the draw position. */
	offsetX: number;
	offsetY: number;
	/** Scale multiplier (1 = no change). */
	scale: number;
}

/** No-op result — element renders as static, unmodified text. */
const STATIC: ResolvedTextAnimation = {
	visibleText: "",
	opacity: 1,
	offsetX: 0,
	offsetY: 0,
	scale: 1,
};

/** Normalize an animation's effective duration: 0 (or negative) → +Infinity. */
function effectiveDuration(animation: TextAnimation | undefined): number {
	if (!animation || animation.duration <= 0) return Number.POSITIVE_INFINITY;
	return animation.duration;
}

/** Clamp a value to [min, max]. */
function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/**
 * Smoothstep ease-in-out for [0,1] → [0,1]. Matches the feel of the named
 * `ease-in-out` keyframe preset without needing a keyframe object.
 */
function smoothstep(progress: number): number {
	const p = clamp(progress, 0, 1);
	return p * p * (3 - 2 * p);
}

/**
 * Resolve the per-frame text animation state.
 *
 * @param animation   The element's `textAnimation` config (or undefined).
 * @param localTime   Seconds from the element's start.
 * @param fullText    The element's full `content` string.
 * @param baseScale   Optional base scale (unused for now; reserved for future
 *                    scale-relative offsets). Defaults to 1.
 */
export function resolveTextAnimation({
	animation,
	localTime,
	fullText,
	baseScale = 1,
}: {
	animation: TextAnimation | undefined;
	localTime: number;
	fullText: string;
	baseScale?: number;
}): ResolvedTextAnimation {
	if (!animation || animation.type === "none") {
		return { ...STATIC, visibleText: fullText };
	}

	const duration = effectiveDuration(animation);
	const intensity = clamp(animation.intensity ?? 1, 0, 1);
	// Progress through the animation in [0,1]. Past the duration, clamp to 1.
	const progress =
		duration === Number.POSITIVE_INFINITY
			? 0
			: clamp(localTime / duration, 0, 1);

	const result: ResolvedTextAnimation = {
		visibleText: fullText,
		opacity: 1,
		offsetX: 0,
		offsetY: 0,
		scale: 1,
	};

	switch (animation.type) {
		case "typewriter": {
			// Reveal characters one at a time. After the duration, show all.
			if (progress >= 1) break;
			const charCount = Array.from(fullText).length;
			const visibleCount = Math.max(
				0,
				Math.round(progress * charCount),
			);
			result.visibleText = Array.from(fullText)
				.slice(0, visibleCount)
				.join("");
			break;
		}

		case "fade-in": {
			if (progress >= 1) break;
			result.opacity = smoothstep(progress);
			break;
		}

		case "fade-out": {
			// Fade out over the duration; stays invisible after.
			result.opacity = 1 - smoothstep(progress);
			break;
		}

		case "slide-in": {
			if (progress >= 1) break;
			const eased = smoothstep(progress);
			// Slide in from the left; distance scales with intensity.
			result.offsetX = (1 - eased) * -80 * intensity * baseScale;
			result.opacity = eased;
			break;
		}

		case "slide-out": {
			const eased = smoothstep(progress);
			// Slide out to the right as opacity drops.
			result.offsetX = eased * 80 * intensity * baseScale;
			result.opacity = 1 - eased;
			break;
		}

		case "scale-in": {
			if (progress >= 1) break;
			const eased = smoothstep(progress);
			// Grow from 0.3× to 1× while fading in.
			result.scale = 0.3 + 0.7 * eased;
			result.opacity = eased;
			break;
		}

		case "bounce": {
			// A damped vertical bounce that loops for the animation duration.
			// If duration is infinite, bounce forever with a fixed period.
			const period = 0.5; // seconds per bounce
			const t = duration === Number.POSITIVE_INFINITY ? localTime : localTime;
			const phase = (t % period) / period; // [0,1) within one bounce
			// Parabolic arc: 0 → 1 → 0, peak at phase 0.5.
			const arc = 4 * phase * (1 - phase);
			// Amplitude decays with progress when a finite duration is set;
			// stays constant when infinite.
			const decay =
				duration === Number.POSITIVE_INFINITY ? 1 : 1 - progress;
			result.offsetY = -arc * 20 * intensity * baseScale * decay;
			break;
		}

		case "glitch": {
			// Random per-frame offset in a band scaled by intensity.
			// Deterministic-ish using a cheap hash of time so it flickers
			// without depending on a global RNG (keeps preview/export in sync
			// within a frame).
			const seed = Math.sin(localTime * 137.5) * 43758.5453;
			const jitter = (seed - Math.floor(seed)) - 0.5; // [-0.5, 0.5)
			const amp = 8 * intensity * baseScale;
			result.offsetX = jitter * amp;
			result.offsetY =
				(Math.cos(localTime * 211.3) * 43758.5453 -
					Math.floor(Math.cos(localTime * 211.3) * 43758.5453) -
					0.5) *
				amp *
				0.5;
			// Occasional opacity dip for a digital-glitch feel.
			if (duration !== Number.POSITIVE_INFINITY && progress > 0.8) {
				result.opacity = clamp(1 - (progress - 0.8) * 2, 0.4, 1);
			}
			break;
		}

		case "karaoke": {
			// Karaoke highlighting is handled by the existing CaptionWord timing
			// path in TextNode. Here we just ensure full text is visible.
			break;
		}
	}

	return result;
}

/** All available text animation types for UI pickers. */
export const TEXT_ANIMATION_TYPES: TextAnimationType[] = [
	"none",
	"typewriter",
	"fade-in",
	"fade-out",
	"slide-in",
	"slide-out",
	"scale-in",
	"bounce",
	"glitch",
	"karaoke",
];

/** Human-readable category labels for grouping in the picker. */
export const TEXT_ANIMATION_CATEGORY_LABELS: Record<
	"none" | "entrance" | "exit" | "loop" | "highlight",
	string
> = {
	none: "None",
	entrance: "Entrance",
	exit: "Exit",
	loop: "Loop",
	highlight: "Highlight",
};

/** Human-readable label for each animation type (for pickers, to be translated). */
export const TEXT_ANIMATION_TYPE_LABELS: Record<TextAnimationType, string> = {
	none: "None",
	typewriter: "Typewriter",
	"fade-in": "Fade In",
	"fade-out": "Fade Out",
	"slide-in": "Slide In",
	"slide-out": "Slide Out",
	"scale-in": "Scale In",
	bounce: "Bounce",
	glitch: "Glitch",
	karaoke: "Karaoke",
};

/** Which category each animation type belongs to (for UI grouping). */
export const TEXT_ANIMATION_CATEGORIES: Record<
	TextAnimationType,
	"none" | "entrance" | "exit" | "loop" | "highlight"
> = {
	none: "none",
	"fade-in": "entrance",
	"slide-in": "entrance",
	"scale-in": "entrance",
	typewriter: "entrance",
	"fade-out": "exit",
	"slide-out": "exit",
	bounce: "loop",
	glitch: "loop",
	karaoke: "highlight",
};

/** Default intensity per type (some look better subtler). */
export const DEFAULT_INTENSITY: Partial<Record<TextAnimationType, number>> = {
	glitch: 0.7,
	bounce: 0.8,
	"slide-in": 1,
	"slide-out": 1,
};

/** Sensate default duration per type (seconds). */
export const DEFAULT_DURATION: Partial<Record<TextAnimationType, number>> = {
	typewriter: 2,
	"fade-in": 0.5,
	"fade-out": 0.5,
	"slide-in": 0.5,
	"slide-out": 0.5,
	"scale-in": 0.5,
	bounce: 0, // loop forever
	glitch: 0, // loop forever
	karaoke: 0,
};

// ---- Phase composer (in + out) ----

/**
 * Resolve the per-frame render state for an element's combined `in` + `out`
 * text animations.
 *
 * `in` plays from element-local time 0 (entrance). `out` plays over the
 * element's final `out.duration` seconds (exit). When both are set and the
 * timelines overlap, the `out` result takes precedence on offset/scale (it is
 * the "leaving" state) while opacities multiply so a fade-in + fade-out both
 * dim the text. Visible text uses the shorter of the two (typewriter reveal).
 *
 * @param animations       The element's `{ in?, out? }` config.
 * @param localTime        Seconds from the element's start.
 * @param elementDuration  Total element duration in seconds (anchors the out phase).
 * @param fullText         The element's full content string.
 * @param baseScale        Base scale multiplier for offset magnitudes.
 */
export function resolveTextAnimations({
	animations,
	localTime,
	elementDuration,
	fullText,
	baseScale = 1,
}: {
	animations: TextAnimations | undefined;
	localTime: number;
	elementDuration: number;
	fullText: string;
	baseScale?: number;
}): ResolvedTextAnimation {
	if (!animations || (!animations.in && !animations.out)) {
		return { ...STATIC, visibleText: fullText };
	}

	const inResolved = resolveTextAnimation({
		animation: animations.in,
		localTime,
		fullText,
		baseScale,
	});

	const outAnim = animations.out;
	const outDur = outAnim?.duration ?? 0;
	// The out phase starts at `elementDuration - outDur` (clamped ≥ 0). Remap
	// localTime into the out phase's own [0, outDur] window.
	const outStart = Math.max(0, elementDuration - outDur);
	const outLocal = localTime - outStart;
	const outResolved = resolveTextAnimation({
		animation: outAnim,
		localTime: outLocal,
		fullText,
		baseScale,
	});

	// Whether the out phase is currently active (within its window).
	const outActive = outAnim != null && outLocal >= 0 && outLocal < outDur;

	// Compose. When out is active it drives offset/scale/visibleText (the
	// element is "leaving"); otherwise the in result drives them. Opacity
	// always multiplies so fade-in and fade-out compose naturally.
	const visibleText =
		outResolved.visibleText.length <= inResolved.visibleText.length
			? outResolved.visibleText
			: inResolved.visibleText;

	return {
		visibleText,
		opacity: inResolved.opacity * outResolved.opacity,
		offsetX: outActive ? outResolved.offsetX : inResolved.offsetX,
		offsetY: outActive ? outResolved.offsetY : inResolved.offsetY,
		scale: outActive ? outResolved.scale : inResolved.scale,
	};
}

/**
 * Which phase a given animation type belongs to. Entrance/loop/highlight types
 * are "in"; exit types are "out". Used by the v5→v6 migration and the UI to
 * route a single legacy `textAnimation` into the correct phase.
 */
export function phaseForType(type: TextAnimationType): TextAnimationPhase {
	return type === "fade-out" || type === "slide-out" ? "out" : "in";
}
