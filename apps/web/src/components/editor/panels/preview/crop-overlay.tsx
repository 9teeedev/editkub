"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { EditorCore } from "@/core";
import { useEditor } from "@/hooks/use-editor";
import { useCropStore } from "@/stores/crop-store";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";
import {
	CROP_DEFAULT,
	MIN_CROP,
	type CropConfig,
} from "@/lib/renderer/crop";
import type { ImageElement, VideoElement } from "@/types/timeline";
import { computeMediaBounds } from "./selection-overlay";

type CropHandle =
	| "move"
	| "top-left"
	| "top-right"
	| "bottom-left"
	| "bottom-right"
	| "left"
	| "right"
	| "top"
	| "bottom";

const HANDLE_SIZE = 10;

interface CropDragState {
	mode: CropHandle;
	pointerId: number;
	startCrop: CropConfig;
	/** Pointer offset inside the rect at drag start (for "move"). */
	grabX: number;
	grabY: number;
	/** Tracks snapshot captured at drag start for single-undo commit. */
	tracksSnapshot: TimelineTracks | null;
	lastCrop: CropConfig | null;
}

type TimelineTracks = ReturnType<EditorCore["timeline"]["getTracks"]>;

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), max);

function getHandleCursor(handle: CropHandle): string {
	switch (handle) {
		case "top-left":
		case "bottom-right":
			return "nwse-resize";
		case "top-right":
		case "bottom-left":
			return "nesw-resize";
		case "left":
		case "right":
			return "ew-resize";
		case "top":
		case "bottom":
			return "ns-resize";
		case "move":
			return "move";
	}
}

/** Rect for `mode` with the pointer edge at normalized source point sx/sy. */
function resizeCropForMode({
	mode,
	start,
	sx,
	sy,
	grabX,
	grabY,
}: {
	mode: CropHandle;
	start: CropConfig;
	sx: number;
	sy: number;
	grabX: number;
	grabY: number;
}): CropConfig {
	const { x, y, width, height } = start;
	let nextX = x;
	let nextY = y;
	let nextW = width;
	let nextH = height;

	if (mode === "move") {
		nextX = clamp(sx - grabX, 0, 1 - width);
		nextY = clamp(sy - grabY, 0, 1 - height);
		return { x: nextX, y: nextY, width, height };
	}

	if (mode.includes("left")) {
		nextX = clamp(sx, 0, x + width - MIN_CROP);
		nextW = x + width - nextX;
	}
	if (mode.includes("right")) {
		nextW = clamp(sx - x, MIN_CROP, 1 - x);
	}
	if (mode.includes("top")) {
		nextY = clamp(sy, 0, y + height - MIN_CROP);
		nextH = y + height - nextY;
	}
	if (mode.includes("bottom")) {
		nextH = clamp(sy - y, MIN_CROP, 1 - y);
	}

	return { x: nextX, y: nextY, width: nextW, height: nextH };
}

const HANDLES: CropHandle[] = [
	"top-left",
	"top-right",
	"bottom-left",
	"bottom-right",
	"left",
	"right",
	"top",
	"bottom",
];

export function CropOverlay({
	displaySize,
}: {
	displaySize: { width: number; height: number };
}) {
	const editor = useEditor();
	const cropElementId = useCropStore((s) => s.elementId);
	const setCropping = useCropStore((s) => s.setCropping);
	const { selectedElements } = useElementSelection();
	const rootRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<CropDragState | null>(null);

	const activeProject = editor.project.getActive();
	const canvasWidth = activeProject?.settings.canvasSize.width ?? 0;
	const canvasHeight = activeProject?.settings.canvasSize.height ?? 0;
	const displayScale = canvasWidth > 0 ? displaySize.width / canvasWidth : 1;

	const mediaAssets = editor.media.getAssets();
	const mediaMap = useMemo(
		() => new Map(mediaAssets.map((asset) => [asset.id, asset])),
		[mediaAssets],
	);

	// No memo here: `selectedElements`/`editor.timeline` keep their identity
	// while crop values change, so a memoized element would freeze `crop` at
	// the value it had when crop mode was entered and each new drag gesture
	// would start from (and reset to) that stale value.
	const selectionRef = cropElementId
		? selectedElements.find((r) => r.elementId === cropElementId)
		: undefined;
	const elementWithTrack = selectionRef
		? editor.timeline.getElementsWithTracks({ elements: [selectionRef] })[0]
		: undefined;

	const element = elementWithTrack?.element as
		| VideoElement
		| ImageElement
		| undefined;
	const trackId = elementWithTrack?.track.id;
	const media = element ? mediaMap.get(element.mediaId) : undefined;

	// Exit crop mode when the element is deselected or deleted.
	useEffect(() => {
		if (cropElementId && !element) {
			setCropping(null);
		}
	}, [cropElementId, element, setCropping]);

	/**
	 * Convert a pointer position to normalized source-space coords, undoing
	 * the element's rotate/flip so handles track what the user sees.
	 */
	const getNormalizedSourcePoint = useCallback(
		(clientX: number, clientY: number) => {
			const root = rootRef.current;
			if (!root || !element) return null;

			const frame = computeMediaBounds({
				element,
				media,
				canvasWidth,
				canvasHeight,
				displayScale,
				uncropped: true,
			});
			if (!frame || frame.width <= 0 || frame.height <= 0) return null;

			const rect = root.getBoundingClientRect();
			let px = clientX - rect.left;
			let py = clientY - rect.top;

			const cx = frame.left + frame.width / 2;
			const cy = frame.top + frame.height / 2;
			const theta = (frame.rotate * Math.PI) / 180;
			if (theta !== 0) {
				const dx = px - cx;
				const dy = py - cy;
				const cos = Math.cos(-theta);
				const sin = Math.sin(-theta);
				px = cx + dx * cos - dy * sin;
				py = cy + dx * sin + dy * cos;
			}

			let nx = clamp((px - frame.left) / frame.width, -0.5, 1.5);
			let ny = clamp((py - frame.top) / frame.height, -0.5, 1.5);
			if (element.transform.flipX) nx = 1 - nx;
			if (element.transform.flipY) ny = 1 - ny;

			return { sx: nx, sy: ny };
		},
		[element, media, canvasWidth, canvasHeight, displayScale],
	);

	const applyCropLive = useCallback(
		(crop: CropConfig) => {
			if (!element || !trackId) return;
			editor.timeline.updateElements({
				updates: [
					{
						trackId,
						elementId: element.id,
						updates: { crop },
					},
				],
				pushHistory: false,
			});
		},
		[editor.timeline, element, trackId],
	);

	const handlePointerDown = useCallback(
		(event: React.PointerEvent, mode: CropHandle) => {
			if (!element || !trackId) return;
			event.stopPropagation();
			event.preventDefault();

			const point = getNormalizedSourcePoint(event.clientX, event.clientY);
			if (!point) return;

			const startCrop: CropConfig = element.crop
				? { ...element.crop }
				: { ...CROP_DEFAULT };

			dragRef.current = {
				mode,
				pointerId: event.pointerId,
				startCrop,
				grabX: point.sx - startCrop.x,
				grabY: point.sy - startCrop.y,
				tracksSnapshot: editor.timeline.getTracks(),
				lastCrop: null,
			};

			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		},
		[element, trackId, editor.timeline, getNormalizedSourcePoint],
	);

	const handlePointerMove = useCallback(
		(event: React.PointerEvent) => {
			const drag = dragRef.current;
			if (!drag || drag.pointerId !== event.pointerId) return;

			const point = getNormalizedSourcePoint(event.clientX, event.clientY);
			if (!point) return;

			const next = resizeCropForMode({
				mode: drag.mode,
				start: drag.startCrop,
				sx: point.sx,
				sy: point.sy,
				grabX: drag.grabX,
				grabY: drag.grabY,
			});

			drag.lastCrop = next;
			applyCropLive(next);
		},
		[getNormalizedSourcePoint, applyCropLive],
	);

	const handlePointerUp = useCallback(
		(event: React.PointerEvent) => {
			const drag = dragRef.current;
			if (!drag || drag.pointerId !== event.pointerId) return;

			const last = drag.lastCrop;
			dragRef.current = null;

			if (!last || !element || !trackId) return;

			// Snapshot-restore + commit: fuses the whole gesture into one
			// undo step (same pattern as scale/move drags).
			if (drag.tracksSnapshot) {
				editor.timeline.updateTracks(drag.tracksSnapshot);
			}
			editor.timeline.updateElements({
				updates: [
					{
						trackId,
						elementId: element.id,
						updates: { crop: last },
					},
				],
				pushHistory: true,
			});
		},
		[editor.timeline, element, trackId],
	);

	if (
		!element ||
		!trackId ||
		!media ||
		displaySize.width === 0 ||
		canvasWidth === 0
	) {
		return null;
	}

	const currentTime = editor.playback.getCurrentTime();
	const visible =
		currentTime >= element.startTime &&
		currentTime < element.startTime + element.duration;
	if (!visible) return null;

	const frame = computeMediaBounds({
		element,
		media,
		canvasWidth,
		canvasHeight,
		displayScale,
		uncropped: true,
	});
	if (!frame) return null;

	const crop = element.crop ?? CROP_DEFAULT;
	// Source → screen coords: flip mirrors the rect inside the frame.
	const screenX = element.transform.flipX ? 1 - crop.x - crop.width : crop.x;
	const screenY = element.transform.flipY ? 1 - crop.y - crop.height : crop.y;

	return (
		<div ref={rootRef} className="pointer-events-none absolute inset-0">
			<div
				className="pointer-events-none absolute"
				style={{
					left: frame.left,
					top: frame.top,
					width: frame.width,
					height: frame.height,
					transform:
						frame.rotate !== 0 ? `rotate(${frame.rotate}deg)` : undefined,
					transformOrigin: "center center",
					zIndex: 1100,
				}}
			>
				{/* Crop rect: darkens everything outside via a huge box-shadow. */}
				<div
					className="pointer-events-auto absolute cursor-move"
					style={{
						left: `${screenX * 100}%`,
						top: `${screenY * 100}%`,
						width: `${crop.width * 100}%`,
						height: `${crop.height * 100}%`,
						boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)",
						touchAction: "none",
					}}
					onPointerDown={(event) => handlePointerDown(event, "move")}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerCancel={handlePointerUp}
				>
					<div className="pointer-events-none absolute inset-0 border-2 border-white" />
					{/* Rule-of-thirds guides */}
					<div className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-white/40" />
					<div className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-white/40" />
					<div className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-white/40" />
					<div className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-white/40" />

					{HANDLES.map((handle) => (
						<div
							key={handle}
							className="border-foreground pointer-events-auto absolute rounded-sm border bg-white"
							style={{
								width: HANDLE_SIZE,
								height: HANDLE_SIZE,
								cursor: getHandleCursor(handle),
								touchAction: "none",
								...(handle.includes("top")
									? { top: -HANDLE_SIZE / 2 }
									: handle.includes("bottom")
										? { bottom: -HANDLE_SIZE / 2 }
										: { top: `calc(50% - ${HANDLE_SIZE / 2}px)` }),
								...(handle.includes("left")
									? { left: -HANDLE_SIZE / 2 }
									: handle.includes("right")
										? { right: -HANDLE_SIZE / 2 }
										: { left: `calc(50% - ${HANDLE_SIZE / 2}px)` }),
							}}
							onPointerDown={(event) => handlePointerDown(event, handle)}
							onPointerMove={handlePointerMove}
							onPointerUp={handlePointerUp}
							onPointerCancel={handlePointerUp}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
