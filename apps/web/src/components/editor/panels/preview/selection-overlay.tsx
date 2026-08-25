import { useSyncExternalStore, useMemo } from "react";
import { useEditor } from "@/hooks/use-editor";
import { cn } from "@/utils/ui";
import type {
	TimelineElement,
	VideoElement,
	ImageElement,
	TextElement,
	StickerElement,
	BlurEffectElement,
	ElementType,
} from "@/types/timeline";
import type { MediaAsset } from "@/types/assets";
import { getTextScaleFactor } from "@/constants/text-constants";
import { isBottomAlignedSubtitleText } from "@/lib/timeline/text-utils";
import { resolveAnimatedProperties } from "@/lib/timeline/keyframe-utils";
import { canvasFontFamily } from "@/lib/canvas-fonts";
import {
	wrapCaptionWords,
	scaleBoxWidth,
} from "@/services/renderer/nodes/text-node";

type ScaleHandle = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type ResizeHandle = "left" | "right" | "top" | "bottom";

const HANDLE_SIZE = 10;
const RESIZE_HANDLE_WIDTH = 6;
const RESIZE_HANDLE_HEIGHT = 24;
/** Invisible hit zone around every handle — fingers need ≥28px. */
const HANDLE_HIT_SIZE = 30;

const SCALE_HANDLES: ScaleHandle[] = [
	"top-left",
	"top-right",
	"bottom-left",
	"bottom-right",
];

export interface ElementBounds {
	left: number;
	top: number;
	width: number;
	height: number;
	rotate: number;
}

function getHandleHitPosition({ handle }: { handle: ScaleHandle }) {
	switch (handle) {
		case "top-left":
			return {
				left: -HANDLE_HIT_SIZE / 2,
				top: -HANDLE_HIT_SIZE / 2,
			};
		case "top-right":
			return {
				right: -HANDLE_HIT_SIZE / 2,
				top: -HANDLE_HIT_SIZE / 2,
			};
		case "bottom-left":
			return {
				left: -HANDLE_HIT_SIZE / 2,
				bottom: -HANDLE_HIT_SIZE / 2,
			};
		case "bottom-right":
			return {
				right: -HANDLE_HIT_SIZE / 2,
				bottom: -HANDLE_HIT_SIZE / 2,
			};
	}
}

function getHandleCursor({ handle }: { handle: ScaleHandle }) {
	switch (handle) {
		case "top-left":
		case "bottom-right":
			return "nwse-resize";
		case "top-right":
		case "bottom-left":
			return "nesw-resize";
	}
}

/**
 * Bounds of the element's *rendered* (post-crop) frame on screen, mirroring
 * the renderer's contain-fit math. Exported for the crop overlay.
 */
export function computeMediaBounds({
	element,
	media,
	canvasWidth,
	canvasHeight,
	displayScale,
	uncropped = false,
}: {
	element: VideoElement | ImageElement;
	media: MediaAsset | undefined;
	canvasWidth: number;
	canvasHeight: number;
	displayScale: number;
	/** Skip the crop so the overlay can show the full source frame. */
	uncropped?: boolean;
}): ElementBounds | null {
	if (!media) return null;

	const mediaW = media.width || canvasWidth;
	const mediaH = media.height || canvasHeight;
	const containScale = Math.min(canvasWidth / mediaW, canvasHeight / mediaH);
	const fullW = mediaW * containScale * element.transform.scale;
	const fullH = mediaH * containScale * element.transform.scale;
	const baseX = canvasWidth / 2 + element.transform.position.x - fullW / 2;
	const baseY = canvasHeight / 2 + element.transform.position.y - fullH / 2;

	// Crop keeps the uncropped layout; the visible box is the kept sub-rect
	// at its original position (mirrors the renderer's drawImage source rect).
	const crop = element.crop;
	if (!uncropped && crop) {
		return {
			left: (baseX + crop.x * fullW) * displayScale,
			top: (baseY + crop.y * fullH) * displayScale,
			width: crop.width * fullW * displayScale,
			height: crop.height * fullH * displayScale,
			rotate: element.transform.rotate,
		};
	}

	return {
		left: baseX * displayScale,
		top: baseY * displayScale,
		width: fullW * displayScale,
		height: fullH * displayScale,
		rotate: element.transform.rotate,
	};
}

// Offscreen context reused for measuring caption text — same font metrics
// as the renderer, so bounds hug the drawn words.
let measureContext: CanvasRenderingContext2D | null = null;
function getMeasureContext(): CanvasRenderingContext2D | null {
	if (measureContext) return measureContext;
	if (typeof document === "undefined") return null;
	const canvas = document.createElement("canvas");
	canvas.width = 8;
	canvas.height = 8;
	measureContext = canvas.getContext("2d");
	return measureContext;
}

/**
 * Measure a karaoke caption element with real font metrics using the
 * renderer's own word-wrap layout — character-count estimates drift badly
 * for Thai (combining marks) and loaded web fonts.
 */
function measureCaptionTextBounds({
	element,
	canvasWidth,
	canvasHeight,
}: {
	element: TextElement;
	canvasWidth: number;
	canvasHeight: number;
}): { width: number; height: number } | null {
	const context = getMeasureContext();
	if (!context || !element.wordTimings || element.wordTimings.length === 0) {
		return null;
	}

	const scaleFactor = getTextScaleFactor({ canvasWidth, canvasHeight });
	const scaledFontSize = element.fontSize * scaleFactor;
	const fontStyle = element.fontStyle === "italic" ? "italic" : "normal";
	const fontWeight = element.fontWeight === "bold" ? "bold" : "normal";
	context.font = `${fontStyle} ${fontWeight} ${scaledFontSize}px ${canvasFontFamily(element.fontFamily)}`;

	const spaceWidth = context.measureText(" ").width;
	const hasBoxWidth = element.boxWidth !== undefined && element.boxWidth > 0;
	const maxWidth = hasBoxWidth
		? scaleBoxWidth({
				boxWidth: element.boxWidth as number,
				canvasWidth,
				canvasHeight,
			})
		: canvasWidth * 0.8;

	const lines = wrapCaptionWords({
		context,
		words: element.wordTimings,
		spaceWidth,
		maxWidth,
	});
	const lineHeight = scaledFontSize * 1.3;
	const width = Math.max(...lines.map((line) => line.width));
	return { width, height: lines.length * lineHeight };
}

function computeTextBounds({
	element,
	canvasWidth,
	canvasHeight,
	displayScale,
}: {
	element: TextElement;
	canvasWidth: number;
	canvasHeight: number;
	displayScale: number;
}): ElementBounds {
	const scaleFactor = getTextScaleFactor({ canvasWidth, canvasHeight });
	const scaledFontSize = element.fontSize * scaleFactor;

	const elementBoxWidth = element.boxWidth;
	const hasBoxWidth =
		elementBoxWidth !== undefined && elementBoxWidth > 0;
	const scaledBoxWidth = hasBoxWidth ? elementBoxWidth * scaleFactor : 0;

	let estimatedWidth: number;
	let estimatedHeight: number;
	const elementScale = element.transform.scale;

	// Karaoke captions: measure the real wrapped layout instead of
	// estimating from character counts.
	const measured = measureCaptionTextBounds({
		element,
		canvasWidth,
		canvasHeight,
	});
	if (measured) {
		estimatedWidth = measured.width;
		estimatedHeight = measured.height;
	} else if (hasBoxWidth) {
		estimatedWidth = scaledBoxWidth;
		const lineHeight = scaledFontSize * 1.3;
		const charsPerLine = Math.max(
			1,
			Math.floor(scaledBoxWidth / (scaledFontSize * 0.6)),
		);
		const lineCount = Math.max(
			1,
			Math.ceil(element.content.length / charsPerLine),
		);
		estimatedHeight = lineCount * lineHeight;
	} else {
		estimatedWidth = element.content.length * scaledFontSize * 0.6;
		estimatedHeight = scaledFontSize * 1.4;
	}

	const centerX = canvasWidth / 2 + element.transform.position.x;
	const baseY = canvasHeight / 2 + element.transform.position.y;
	const isBottomAligned = isBottomAlignedSubtitleText({ element });
	const scaledEstimatedWidth = estimatedWidth * elementScale;
	const scaledEstimatedHeight = estimatedHeight * elementScale;
	const topY = isBottomAligned
		? baseY - scaledEstimatedHeight
		: baseY - scaledEstimatedHeight / 2;

	return {
		left: (centerX - scaledEstimatedWidth / 2) * displayScale,
		top: topY * displayScale,
		width: scaledEstimatedWidth * displayScale,
		height: scaledEstimatedHeight * displayScale,
		rotate: element.transform.rotate,
	};
}

function computeStickerBounds({
	element,
	canvasWidth,
	canvasHeight,
	displayScale,
}: {
	element: StickerElement;
	canvasWidth: number;
	canvasHeight: number;
	displayScale: number;
}): ElementBounds {
	const stickerSource = 200;
	const containScale = Math.min(
		canvasWidth / stickerSource,
		canvasHeight / stickerSource,
	);
	const stickerSize = stickerSource * containScale * element.transform.scale;

	const centerX = canvasWidth / 2 + element.transform.position.x;
	const centerY = canvasHeight / 2 + element.transform.position.y;

	return {
		left: (centerX - stickerSize / 2) * displayScale,
		top: (centerY - stickerSize / 2) * displayScale,
		width: stickerSize * displayScale,
		height: stickerSize * displayScale,
		rotate: element.transform.rotate,
	};
}

function computeBlurEffectBounds({
	element,
	canvasWidth,
	canvasHeight,
	displayScale,
}: {
	element: BlurEffectElement;
	canvasWidth: number;
	canvasHeight: number;
	displayScale: number;
}): ElementBounds {
	// scale=1 → full canvas, scale=0.5 → half canvas
	// boxWidth narrows the width independently (default 1 = proportional)
	const boxWidth = element.boxWidth ?? 1;
	const boxHeight = element.boxHeight ?? 1;
	const regionWidth = canvasWidth * element.transform.scale * boxWidth;
	const regionHeight = canvasHeight * element.transform.scale * boxHeight;

	const centerX = canvasWidth / 2 + element.transform.position.x;
	const centerY = canvasHeight / 2 + element.transform.position.y;

	return {
		left: (centerX - regionWidth / 2) * displayScale,
		top: (centerY - regionHeight / 2) * displayScale,
		width: regionWidth * displayScale,
		height: regionHeight * displayScale,
		rotate: element.transform.rotate,
	};
}

function computeElementBounds({
	element,
	media,
	canvasWidth,
	canvasHeight,
	displayScale,
	currentTime,
}: {
	element: TimelineElement;
	media: MediaAsset | undefined;
	canvasWidth: number;
	canvasHeight: number;
	displayScale: number;
	currentTime: number;
}): ElementBounds | null {
	// Resolve the animated transform/opacity at the playhead, mirroring the
	// renderer so the selection box tracks the same frame the user sees.
	// `transform` only exists on visual elements; audio is filtered upstream
	// but we narrow here too to satisfy the union type.
	type VisualElement =
		| VideoElement
		| ImageElement
		| TextElement
		| StickerElement
		| BlurEffectElement;
	const isVisual = (
		e: TimelineElement,
	): e is VisualElement & {
			transform: VisualElement["transform"];
			opacity: number;
			keyframes?: VisualElement["keyframes"];
		} =>
		e.type === "video" ||
		e.type === "image" ||
		e.type === "text" ||
		e.type === "sticker" ||
		e.type === "blur-effect";

	if (!isVisual(element)) return null;

	const localTime = Math.max(
		0,
		Math.min(element.duration, currentTime - element.startTime),
	);
	const { transform: resolvedTransform } = resolveAnimatedProperties({
		keyframes: element.keyframes,
		time: localTime,
		baseTransform: element.transform,
		baseOpacity: element.opacity,
	});
	const resolvedElement = {
		...element,
		transform: resolvedTransform,
	} as VisualElement;

	switch (element.type) {
		case "video":
		case "image":
			return computeMediaBounds({
				element: resolvedElement as VideoElement | ImageElement,
				media,
				canvasWidth,
				canvasHeight,
				displayScale,
			});
		case "text":
			return computeTextBounds({
				element: resolvedElement as TextElement,
				canvasWidth,
				canvasHeight,
				displayScale,
			});
		case "sticker":
			return computeStickerBounds({
				element: resolvedElement as StickerElement,
				canvasWidth,
				canvasHeight,
				displayScale,
			});
		case "blur-effect":
			return computeBlurEffectBounds({
				element: resolvedElement as BlurEffectElement,
				canvasWidth,
				canvasHeight,
				displayScale,
			});
		default:
			return null;
	}
}

function ElementOverlay({
	bounds,
	elementType,
	isTransforming,
	onScaleStart,
	onResizeStart,
}: {
	bounds: ElementBounds;
	elementType: ElementType;
	isTransforming: boolean;
	onScaleStart: ({
		event,
		handle,
	}: { event: React.PointerEvent; handle: ScaleHandle }) => void;
	onResizeStart?: ({
		event,
		handle,
	}: { event: React.PointerEvent; handle: ResizeHandle }) => void;
}) {
	const showResizeHandles =
		(elementType === "text" || elementType === "blur-effect") && onResizeStart;

	return (
		<div
			className="pointer-events-none absolute"
			style={{
				left: bounds.left,
				top: bounds.top,
				width: bounds.width,
				height: bounds.height,
				transform: bounds.rotate !== 0 ? `rotate(${bounds.rotate}deg)` : undefined,
				transformOrigin: "center center",
				zIndex: 1000,
			}}
		>
			{/* Selection border */}
			<div
				className={cn(
					"absolute inset-0 rounded border-2",
					isTransforming ? "border-primary/70" : "border-primary",
				)}
			/>

			{/* Corner handles (proportional scale) — fat invisible hit zones so
			    fingers can grab them; the visible dot stays HANDLE_SIZE. */}
			{SCALE_HANDLES.map((handle) => (
				<div
					key={handle}
					className="pointer-events-auto absolute flex items-center justify-center"
					style={{
						width: HANDLE_HIT_SIZE,
						height: HANDLE_HIT_SIZE,
						cursor: getHandleCursor({ handle }),
						touchAction: "none",
						...getHandleHitPosition({ handle }),
					}}
					onPointerDown={(event) => {
						event.stopPropagation();
						onScaleStart({ event, handle });
					}}
				>
					<div
						className="bg-primary border-background rounded-sm border"
						style={{ width: HANDLE_SIZE, height: HANDLE_SIZE }}
					/>
				</div>
			))}

			{/* Side handles for text width resize */}
			{showResizeHandles && (
				<>
					{/* Left handle */}
					<div
						className="pointer-events-auto absolute flex items-center justify-center"
						style={{
							width: HANDLE_HIT_SIZE,
							height: HANDLE_HIT_SIZE + RESIZE_HANDLE_HEIGHT - HANDLE_SIZE,
							cursor: "ew-resize",
							touchAction: "none",
							left: -HANDLE_HIT_SIZE / 2,
							top: "50%",
							transform: "translateY(-50%)",
						}}
						onPointerDown={(event) => {
							event.stopPropagation();
							onResizeStart({ event, handle: "left" });
						}}
					>
						<div
							className="bg-primary border-background rounded-sm border"
							style={{
								width: RESIZE_HANDLE_WIDTH,
								height: RESIZE_HANDLE_HEIGHT,
							}}
						/>
					</div>
					{/* Right handle */}
					<div
						className="pointer-events-auto absolute flex items-center justify-center"
						style={{
							width: HANDLE_HIT_SIZE,
							height: HANDLE_HIT_SIZE + RESIZE_HANDLE_HEIGHT - HANDLE_SIZE,
							cursor: "ew-resize",
							touchAction: "none",
							right: -HANDLE_HIT_SIZE / 2,
							top: "50%",
							transform: "translateY(-50%)",
						}}
						onPointerDown={(event) => {
							event.stopPropagation();
							onResizeStart({ event, handle: "right" });
						}}
					>
						<div
							className="bg-primary border-background rounded-sm border"
							style={{
								width: RESIZE_HANDLE_WIDTH,
								height: RESIZE_HANDLE_HEIGHT,
							}}
						/>
					</div>
				</>
			)}

			{/* Top/bottom handles for blur-effect height resize */}
			{elementType === "blur-effect" && onResizeStart && (
				<>
					{/* Top handle */}
					<div
						className="pointer-events-auto absolute flex items-center justify-center"
						style={{
							width: HANDLE_HIT_SIZE + RESIZE_HANDLE_HEIGHT - HANDLE_SIZE,
							height: HANDLE_HIT_SIZE,
							cursor: "ns-resize",
							touchAction: "none",
							top: -HANDLE_HIT_SIZE / 2,
							left: "50%",
							transform: "translateX(-50%)",
						}}
						onPointerDown={(event) => {
							event.stopPropagation();
							onResizeStart({ event, handle: "top" });
						}}
					>
						<div
							className="bg-primary border-background rounded-sm border"
							style={{
								width: RESIZE_HANDLE_HEIGHT,
								height: RESIZE_HANDLE_WIDTH,
							}}
						/>
					</div>
					{/* Bottom handle */}
					<div
						className="pointer-events-auto absolute flex items-center justify-center"
						style={{
							width: HANDLE_HIT_SIZE + RESIZE_HANDLE_HEIGHT - HANDLE_SIZE,
							height: HANDLE_HIT_SIZE,
							cursor: "ns-resize",
							touchAction: "none",
							bottom: -HANDLE_HIT_SIZE / 2,
							left: "50%",
							transform: "translateX(-50%)",
						}}
						onPointerDown={(event) => {
							event.stopPropagation();
							onResizeStart({ event, handle: "bottom" });
						}}
					>
						<div
							className="bg-primary border-background rounded-sm border"
							style={{
								width: RESIZE_HANDLE_HEIGHT,
								height: RESIZE_HANDLE_WIDTH,
							}}
						/>
					</div>
				</>
			)}
		</div>
	);
}

export function SelectionOverlay({
	displaySize,
	onScaleStart,
	onResizeStart,
	isTransforming,
}: {
	displaySize: { width: number; height: number };
	onScaleStart: ({
		event,
		handle,
		element,
		trackId,
	}: {
		event: React.PointerEvent;
		handle: ScaleHandle;
		element: TimelineElement;
		trackId: string;
	}) => void;
	onResizeStart: ({
		event,
		handle,
		element,
		trackId,
	}: {
		event: React.PointerEvent;
		handle: ResizeHandle;
		element: TimelineElement;
		trackId: string;
	}) => void;
	isTransforming: boolean;
}) {
	const editor = useEditor();

	const selectedElements = useSyncExternalStore(
		(listener) => editor.selection.subscribe(listener),
		() => editor.selection.getSelectedElements(),
	);

	const currentTime = editor.playback.getCurrentTime();
	const activeProject = editor.project.getActive();
	const mediaAssets = editor.media.getAssets();
	const canvasWidth = activeProject?.settings.canvasSize.width ?? 0;
	const canvasHeight = activeProject?.settings.canvasSize.height ?? 0;
	const displayScale = canvasWidth > 0 ? displaySize.width / canvasWidth : 1;

	const mediaMap = useMemo(
		() => new Map(mediaAssets.map((asset) => [asset.id, asset])),
		[mediaAssets],
	);

	const elementsWithTracks = editor.timeline.getElementsWithTracks({
		elements: selectedElements,
	});

	const visibleElements = elementsWithTracks.filter(({ element }) => {
		if (element.type === "audio") return false;
		return (
			currentTime >= element.startTime &&
			currentTime < element.startTime + element.duration
		);
	});

	if (visibleElements.length === 0 || displaySize.width === 0) {
		return null;
	}

	return (
		<>
			{visibleElements.map(({ track, element }) => {
				const media =
					"mediaId" in element
						? mediaMap.get(element.mediaId)
						: undefined;

				const bounds = computeElementBounds({
					element,
					media,
					canvasWidth,
					canvasHeight,
					displayScale,
					currentTime,
				});

				if (!bounds) return null;

				return (
					<ElementOverlay
						key={element.id}
						bounds={bounds}
						elementType={element.type}
						isTransforming={isTransforming}
						onScaleStart={({ event, handle }) =>
							onScaleStart({
								event,
								handle,
								element,
								trackId: track.id,
							})
						}
						onResizeStart={({ event, handle }) =>
							onResizeStart({
								event,
								handle,
								element,
								trackId: track.id,
							})
						}
					/>
				);
			})}
		</>
	);
}
