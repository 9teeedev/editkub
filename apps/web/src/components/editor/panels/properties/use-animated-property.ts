"use client";

import { useEditor } from "@/hooks/use-editor";
import { hasChannel, sampleChannel } from "@/lib/timeline/keyframe-utils";
import type { ElementKeyframes, KeyframeProperty } from "@/types/timeline";

/**
 * Resolve the live display value for an animatable property.
 *
 * - When the channel has no keyframes, returns `baseValue` (the static value
 *   from `element.transform.*` / `element.opacity`).
 * - When the channel is animated, samples the channel at the current playhead
 *   position (mapped to element-local time) and returns that value.
 *
 * Reads `editor.playback.getCurrentTime()` at the top level, so the calling
 * component re-renders on every playback tick via `useEditor()` and the
 * returned value tracks the playhead live.
 *
 * IMPORTANT: callers that let the user type a draft should ignore this value
 * while editing (e.g. `isEditing ? draft : resolvedValue`) so the cursor
 * doesn't jump on each keystroke.
 */
export function useAnimatedProperty({
	keyframes,
	property,
	baseValue,
	elementStartTime,
	elementDuration,
}: {
	keyframes: ElementKeyframes | undefined;
	property: KeyframeProperty;
	baseValue: number;
	elementStartTime: number;
	elementDuration: number;
}): {
	/** True if this channel has any keyframes (controls keyframe-aware UI behavior). */
	isAnimated: boolean;
	/** The value to display: sampled at playhead if animated, else baseValue. */
	resolvedValue: number;
} {
	const editor = useEditor();
	const isAnimated = hasChannel(keyframes, property);

	if (!isAnimated) {
		return { isAnimated: false, resolvedValue: baseValue };
	}

	const current = editor.playback.getCurrentTime();
	const localTime = Math.max(
		0,
		Math.min(elementDuration, current - elementStartTime),
	);
	const { value } = sampleChannel(keyframes?.[property], localTime);
	return { isAnimated: true, resolvedValue: value };
}
