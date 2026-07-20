"use client";

import { useCallback, useRef, useState } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";
import {
	setChannel,
	upsertKeyframe,
	hasAnyKeyframes,
	removeKeyframeById,
	disableChannel,
	countKeyframes,
} from "@/lib/timeline/keyframe-utils";
import type {
	ElementKeyframes,
	Keyframe,
	KeyframeProperty,
	TimelineElement,
} from "@/types/timeline";
import { cn } from "@/utils/ui";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuTrigger,
	ContextMenuSeparator,
	ContextMenuItem,
} from "@/components/ui/context-menu";

/**
 * Diamond color per channel for at-a-glance distinction.
 * position = blue, scale = green, rotate = purple, opacity = orange.
 */
const CHANNEL_COLORS: Record<KeyframeProperty, string> = {
	"position.x": "#3b82f6",
	"position.y": "#3b82f6",
	scale: "#22c55e",
	rotate: "#a855f7",
	opacity: "#f97316",
};

/**
 * Keyframe diamond markers rendered as an overlay on a timeline clip.
 * Click a diamond to seek the playhead; drag horizontally to change the
 * keyframe's time. Only rendered when the element has at least one keyframe.
 *
 * Shared by desktop (`timeline-element.tsx`) and mobile (`mobile-track.tsx`).
 */
export function KeyframeDiamonds({
	element,
	trackId,
	zoomLevel,
	/**
	 * Overrides the pixels-per-second ratio used to position diamonds.
	 * When provided (e.g. mobile passes its own computed ratio), `zoomLevel`
	 * is ignored. Defaults to `PIXELS_PER_SECOND * zoomLevel` for desktop.
	 */
	pxPerSecond: pxPerSecondProp,
	/** "desktop" uses pointer events; "mobile" uses touch (handled by caller). */
	interaction = "desktop",
}: {
	element: TimelineElement;
	trackId: string;
	zoomLevel: number;
	pxPerSecond?: number;
	interaction?: "desktop" | "mobile";
}) {
	const editor = useEditor();
	const { t } = useTranslation();
	const [draggingId, setDraggingId] = useState<string | null>(null);
	const dragStartXRef = useRef(0);
	const dragStartTimeRef = useRef(0);
	const [dragTime, setDragTime] = useState<number | null>(null);

	const rawKeyframes = "keyframes" in element ? element.keyframes : undefined;
	// After the guard below, rawKeyframes is guaranteed non-undefined with at
	// least one keyframe. We keep the cast outside the early return so that
	// hooks below it run unconditionally (rules-of-hooks).
	const allKeyframes = (rawKeyframes ?? {}) as ElementKeyframes;
	const hasAny = hasAnyKeyframes(rawKeyframes);

	const pxPerSecond = pxPerSecondProp ?? TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel;

	const onPointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (!draggingId) return;
			const dx = e.clientX - dragStartXRef.current;
			const dt = dx / pxPerSecond;
			const newTime = Math.max(
				0,
				Math.min(element.duration, dragStartTimeRef.current + dt),
			);
			setDragTime(newTime);
		},
		[draggingId, pxPerSecond, element.duration],
	);

	const onPointerUp = useCallback(
		(e: React.PointerEvent) => {
			if (!draggingId) return;
			e.stopPropagation();
			// Find the dragging keyframe's channel.
			let draggingProp: KeyframeProperty | null = null;
			let draggingKf: Keyframe | null = null;
			for (const property of Object.keys(allKeyframes) as KeyframeProperty[]) {
				const found = (allKeyframes?.[property] ?? []).find(
					(k) => k.id === draggingId,
				);
				if (found) {
					draggingProp = property;
					draggingKf = found;
					break;
				}
			}
			if (draggingProp && draggingKf && dragTime !== null) {
				// Commit with history if the time actually changed.
				if (Math.abs(dragTime - dragStartTimeRef.current) > 0.001) {
					commitKeyframeTime(draggingProp, draggingKf.id, dragTime, true);
				}
			}
			setDraggingId(null);
			setDragTime(null);
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[draggingId, dragTime, allKeyframes],
	);

	// Early return AFTER all hooks have been called.
	if (!hasAny) {
		return null;
	}

	// Flatten all keyframes with their channel for rendering.
	type Diamond = { keyframe: Keyframe; property: KeyframeProperty };
	const diamonds: Diamond[] = [];
	for (const property of Object.keys(allKeyframes) as KeyframeProperty[]) {
		for (const keyframe of allKeyframes[property] ?? []) {
			diamonds.push({ keyframe, property });
		}
	}

	const seekTo = (localTime: number) => {
		const absolute = element.startTime + localTime;
		editor.playback.seek({ time: absolute });
	};

	const deleteKeyframe = (property: KeyframeProperty, keyframeId: string) => {
		const channel = allKeyframes[property] ?? [];
		const next = setChannel(
			allKeyframes,
			property,
			removeKeyframeById(channel, keyframeId),
		);
		editor.timeline.updateKeyframes({
			trackId,
			elementId: element.id,
			keyframes: next,
		});
	};

	const clearChannel = (property: KeyframeProperty) => {
		editor.timeline.updateKeyframes({
			trackId,
			elementId: element.id,
			keyframes: disableChannel(allKeyframes, property),
		});
	};

	const clearAll = () => {
		// Remove keyframes entirely from the element.
		editor.timeline.updateKeyframes({
			trackId,
			elementId: element.id,
			keyframes: undefined,
		});
	};

	const commitKeyframeTime = (
		property: KeyframeProperty,
		keyframeId: string,
		newTime: number,
		pushHistory: boolean,
	) => {
		const channelKfs = allKeyframes?.[property] ?? [];
		const existing = channelKfs.find((k) => k.id === keyframeId);
		if (!existing) return;
		const clamped = Math.max(0, Math.min(element.duration, newTime));
		const updated = { ...existing, time: clamped };
		const nextKeyframes: ElementKeyframes = setChannel(
			allKeyframes,
			property,
			upsertKeyframe(channelKfs, updated),
		);
		editor.timeline.updateKeyframes({
			trackId,
			elementId: element.id,
			keyframes: nextKeyframes,
			pushHistory,
		});
	};

	const onPointerDown = (
		e: React.PointerEvent,
		keyframe: Keyframe,
		property: KeyframeProperty,
	) => {
		if (interaction === "mobile") return; // mobile uses touch gestures
		e.stopPropagation();
		e.preventDefault();
		(e.target as HTMLElement).setPointerCapture?.(e.pointerId);
		setDraggingId(keyframe.id);
		dragStartXRef.current = e.clientX;
		dragStartTimeRef.current = keyframe.time;
		setDragTime(keyframe.time);
	};

	return (
		<div className="pointer-events-none absolute inset-0 z-30">
			{diamonds.map(({ keyframe, property }, index) => {
				const time =
					draggingId === keyframe.id && dragTime !== null
						? dragTime
						: keyframe.time;
				const left = time * pxPerSecond;
				const color = CHANNEL_COLORS[property];
				const channelCount = countKeyframes(allKeyframes);
				const propCount = allKeyframes[property]?.length ?? 0;
				return (
					<ContextMenu key={`${property}:${index}:${keyframe.id}`}>
						<ContextMenuTrigger asChild>
							<div
								className="pointer-events-auto absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
								style={{ left: `${left}px` }}
								title={`${property}: ${keyframe.value.toFixed(2)} @ ${keyframe.time.toFixed(2)}s`}
								onPointerDown={(e) => onPointerDown(e, keyframe, property)}
								onPointerMove={onPointerMove}
								onPointerUp={onPointerUp}
								onClick={(e) => {
									// Click (no drag) seeks the playhead.
									if (
										Math.abs(e.clientX - dragStartXRef.current) < 3 &&
										dragTime === null
									) {
										e.stopPropagation();
										seekTo(keyframe.time);
									}
								}}
								onContextMenu={(e) => {
									// Prevent the timeline's own context menu from opening.
									e.stopPropagation();
								}}
							>
								<span
									className={cn(
										"block size-full rotate-45 rounded-[1px] border shadow-sm",
										draggingId === keyframe.id && "ring-2 ring-white",
									)}
									style={{
										backgroundColor: color,
										borderColor: "rgba(255,255,255,0.8)",
									}}
								/>
							</div>
						</ContextMenuTrigger>
						<ContextMenuContent>
							<ContextMenuItem
								onClick={() => deleteKeyframe(property, keyframe.id)}
								disabled={channelCount <= 2}
							>
								{t("Delete keyframe")}
							</ContextMenuItem>
							<ContextMenuSeparator />
							<ContextMenuItem
								onClick={() => clearChannel(property)}
								disabled={propCount === 0}
							>
								{t("Clear all {{property}} keyframes", { property })}
							</ContextMenuItem>
							<ContextMenuItem onClick={clearAll}>
								{t("Clear all keyframes")}
							</ContextMenuItem>
						</ContextMenuContent>
					</ContextMenu>
				);
			})}
		</div>
	);
}
