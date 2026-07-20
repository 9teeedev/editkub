"use client";

import { useCallback } from "react";
import { useEditor } from "@/hooks/use-editor";
import {
	KEYFRAME_TIME_EPSILON,
	generateKeyframeId,
	hasChannel,
	setChannel,
	upsertKeyframe,
} from "@/lib/timeline/keyframe-utils";
import type { ElementKeyframes, KeyframeProperty } from "@/types/timeline";

/**
 * Auto-keyframe writer for an animatable property channel.
 *
 * Routes a value commit through one of two paths depending on whether the
 * channel is animated:
 *
 * - Animated: upsert a keyframe at the playhead (element-local time) with the
 *   new value. This is "auto-record" / "auto-keyframe" semantics — every
 *   edit at the playhead pins a new keyframe there. If a keyframe already
 *   exists at that time, its value is replaced.
 * - Not animated: call the supplied `fallback`, which performs the panel's
 *   existing static mutation (e.g. `updateTransform`).
 *
 * The `fallback` pattern keeps the writer hook simple and lets each panel
 * keep its own batch/multi-element handling for the static case.
 */
export function useAnimatedValueWriter({
	keyframes,
	property,
	trackId,
	elementId,
	elementStartTime,
	elementDuration,
}: {
	keyframes: ElementKeyframes | undefined;
	property: KeyframeProperty;
	trackId: string;
	elementId: string;
	elementStartTime: number;
	elementDuration: number;
}): {
	/** True if this channel is animated (writer routes to keyframe upsert). */
	isAnimated: boolean;
	/**
	 * Commit a new value. When animated, upserts a keyframe at the playhead;
	 * otherwise invokes `fallback` so the panel can do its static mutation.
	 */
	commitValue: (
		value: number,
		pushHistory: boolean,
		fallback: () => void,
	) => void;
} {
	const editor = useEditor();
	const isAnimated = hasChannel(keyframes, property);

	const commitValue = useCallback(
		(value: number, pushHistory: boolean, fallback: () => void) => {
			if (!hasChannel(keyframes, property)) {
				fallback();
				return;
			}
			const current = editor.playback.getCurrentTime();
			const localTime = Math.max(
				0,
				Math.min(elementDuration, current - elementStartTime),
			);
			const channel = keyframes?.[property] ?? [];
			// Preserve the id and easing of a keyframe at the same time, so a
			// drag/in-progress edit doesn't lose its identity or curve.
			const existing = channel.find(
				(k) => Math.abs(k.time - localTime) < KEYFRAME_TIME_EPSILON,
			);
			const next = setChannel(
				keyframes,
				property,
				upsertKeyframe(channel, {
					id: existing?.id ?? generateKeyframeId(),
					time: localTime,
					value,
					easing: existing?.easing ?? "linear",
					...(existing?.bezierP1 ? { bezierP1: existing.bezierP1 } : {}),
					...(existing?.bezierP2 ? { bezierP2: existing.bezierP2 } : {}),
				}),
			);
			editor.timeline.updateKeyframes({
				trackId,
				elementId,
				keyframes: next,
				pushHistory,
			});
		},
		[
			keyframes,
			property,
			trackId,
			elementId,
			elementStartTime,
			elementDuration,
			editor,
		],
	);

	return { isAnimated, commitValue };
}
