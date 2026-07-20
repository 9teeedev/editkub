"use client";

import { cn } from "@/utils/ui";
import { useEditor } from "@/hooks/use-editor";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import {
	disableChannel,
	enableChannel,
	generateKeyframeId,
	getKeyframeAtTime,
	hasChannel,
	sampleChannel,
	setChannel,
	upsertKeyframe,
} from "@/lib/timeline/keyframe-utils";
import type {
	ElementKeyframes,
	KeyframeProperty,
	Transform,
} from "@/types/timeline";

/**
 * A small keyframe toggle + add button rendered inline next to an animatable
 * property control. Clicking the diamond enables/disables animation for the
 * channel (creating start+end keyframes on first enable). Clicking the "+"
 * adds a keyframe at the playhead's current element-local time.
 *
 * Shared by video/image/text/sticker property panels.
 */
export function KeyframeRow({
	property,
	trackId,
	elementId,
	keyframes,
	baseTransform,
	baseOpacity,
	elementStartTime,
	elementDuration,
	className,
}: {
	property: KeyframeProperty;
	trackId: string;
	elementId: string;
	keyframes: ElementKeyframes | undefined;
	baseTransform: Transform;
	baseOpacity: number;
	/** Absolute timeline start time of the element (for playhead offset). */
	elementStartTime: number;
	elementDuration: number;
	className?: string;
}) {
	const editor = useEditor();
	const { t } = useTranslation();
	const active = hasChannel(keyframes, property);

	const getBaseValue = (): number => {
		switch (property) {
			case "position.x":
				return baseTransform.position.x;
			case "position.y":
				return baseTransform.position.y;
			case "scale":
				return baseTransform.scale;
			case "rotate":
				return baseTransform.rotate;
			case "opacity":
				return baseOpacity;
		}
	};

	const commit = (next: ElementKeyframes | undefined) => {
		editor.timeline.updateKeyframes({
			trackId,
			elementId,
			keyframes: next,
		});
	};

	const toggleChannel = () => {
		if (active) {
			commit(disableChannel(keyframes, property));
		} else {
			commit(
				enableChannel(keyframes, property, getBaseValue(), elementDuration),
			);
		}
	};

	const addKeyframeAtPlayhead = (e: React.MouseEvent) => {
		e.stopPropagation();
		const localTime = editor.playback.getCurrentTime() - elementStartTime;
		// Clamp to element bounds.
		const clamped = Math.max(0, Math.min(elementDuration, localTime));

		const existing = keyframes?.[property] ?? [];
		const atTime = getKeyframeAtTime(existing, clamped);
		let value: number;
		if (atTime) {
			value = atTime.value;
		} else if (existing.length > 0) {
			value = sampleChannel(existing, clamped).value;
		} else {
			value = getBaseValue();
		}

		const newKf = {
			id: generateKeyframeId(),
			time: clamped,
			value,
			easing: "linear" as const,
		};
		commit(setChannel(keyframes, property, upsertKeyframe(existing, newKf)));
	};

	// Show add-button only when the channel is animated (otherwise enabling
	// the channel already seeds start+end keyframes).
	const atPlayhead =
		active &&
		getKeyframeAtTime(
			keyframes?.[property],
			editor.playback.getCurrentTime() - elementStartTime,
		);

	return (
		<div className={cn("flex items-center gap-0.5", className)}>
			<button
				type="button"
				onClick={toggleChannel}
				title={active ? t("Disable keyframes") : t("Enable keyframes")}
				className={cn(
					"flex size-4 items-center justify-center rounded-sm transition-colors",
					active
						? "text-primary"
						: "text-muted-foreground hover:text-foreground",
				)}
			>
				{/* Diamond shape, rotated square */}
				<span
					className={cn(
						"block size-2 rotate-45 rounded-[1px] border",
						active
							? "border-primary bg-primary"
							: "border-current bg-transparent",
					)}
				/>
			</button>
			{active && (
				<button
					type="button"
				onClick={addKeyframeAtPlayhead}
				title={t("Add keyframe at playhead")}
					disabled={!!atPlayhead}
					className={cn(
						"flex size-4 items-center justify-center rounded-sm text-[10px] leading-none transition-colors",
						atPlayhead
							? "cursor-default text-muted-foreground/40"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					+
				</button>
			)}
		</div>
	);
}
