"use client";

import { useRef, useCallback, useEffect, useState, Fragment } from "react";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";
import { TRACK_COLORS } from "@/constants/timeline-constants";
import { cn } from "@/utils/ui";
import { useEditor } from "@/hooks/use-editor";
import Image from "next/image";
import {
	Video01Icon,
	HeadphonesIcon,
	TextIcon,
	Happy01Icon,
	ImageIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMobileDrawerStore } from "../hooks/use-mobile-drawer";
import { KeyframeDiamonds } from "../../panels/timeline/keyframe-diamonds";
import type {
	TimelineTrack,
	TimelineElement,
	TextElement,
	StickerElement,
	VideoElement,
	ImageElement,
	AudioElement,
} from "@/types/timeline";

const MOBILE_TRACK_HEIGHT = 48;
const LONG_PRESS_MS = 300;
const DRAG_MOVE_THRESHOLD = 3;
const EDGE_ZONE_PX = 48;
const EDGE_SCROLL_SPEED = 0.008;

interface DragState {
	elementId: string | null;
	startX: number;
	offsetX: number;
	elementNode: HTMLElement | null;
	originalStartTime: number;
	longPressTimer: ReturnType<typeof setTimeout> | null;
	active: boolean;
	moved: boolean;
	currentTouchX: number;
	autoScrollRaf: number | null;
}

function createInitialDragState(): DragState {
	return {
		elementId: null,
		startX: 0,
		offsetX: 0,
		elementNode: null,
		originalStartTime: 0,
		longPressTimer: null,
		active: false,
		moved: false,
		currentTouchX: 0,
		autoScrollRaf: null,
	};
}

interface TrimState {
	elementId: string;
	trackId: string;
	side: "left" | "right";
	startX: number;
	startTime: number;
	duration: number;
	trimStart: number;
	trimEnd: number;
	/** Playback rate (video only, default 1) — trim math is source-time aware. */
	rate: number;
	/** Source duration for video/audio; null for elements that can extend freely. */
	sourceDuration: number | null;
}

interface TrimPreview {
	elementId: string;
	startTime: number;
	duration: number;
	trimStart: number;
	trimEnd: number;
}

/** Rate-aware trim math mirroring the desktop `use-element-resize` hook. */
function computeTrim({
	trim,
	deltaTime,
	minDuration,
}: {
	trim: TrimState;
	deltaTime: number;
	minDuration: number;
}): TrimPreview {
	const isSourceBound = trim.sourceDuration !== null;

	if (trim.side === "left") {
		if (isSourceBound) {
			const sourceDuration = trim.sourceDuration as number;
			const maxTrimStart = Math.max(
				0,
				sourceDuration - trim.trimEnd - minDuration * trim.rate,
			);
			const newTrimStart = Math.min(
				Math.max(trim.trimStart + deltaTime * trim.rate, 0),
				maxTrimStart,
			);
			const actualDelta = (newTrimStart - trim.trimStart) / trim.rate;
			return {
				elementId: trim.elementId,
				startTime: Math.max(0, trim.startTime + actualDelta),
				duration: Math.max(minDuration, trim.duration - actualDelta),
				trimStart: newTrimStart,
				trimEnd: trim.trimEnd,
			};
		}
		const newStartTime = Math.min(
			Math.max(trim.startTime + deltaTime, 0),
			trim.startTime + trim.duration - minDuration,
		);
		const actualDelta = newStartTime - trim.startTime;
		return {
			elementId: trim.elementId,
			startTime: newStartTime,
			duration: Math.max(minDuration, trim.duration - actualDelta),
			trimStart: trim.trimStart,
			trimEnd: trim.trimEnd,
		};
	}

	if (isSourceBound) {
		const sourceDuration = trim.sourceDuration as number;
		const maxTrimEnd = Math.max(
			0,
			sourceDuration - trim.trimStart - minDuration * trim.rate,
		);
		const newTrimEnd = Math.min(
			Math.max(trim.trimEnd - deltaTime * trim.rate, 0),
			maxTrimEnd,
		);
		const actualDelta = (trim.trimEnd - newTrimEnd) / trim.rate;
		return {
			elementId: trim.elementId,
			startTime: trim.startTime,
			duration: Math.max(minDuration, trim.duration - actualDelta),
			trimStart: trim.trimStart,
			trimEnd: newTrimEnd,
		};
	}

	return {
		elementId: trim.elementId,
		startTime: trim.startTime,
		duration: Math.max(minDuration, trim.duration - deltaTime),
		trimStart: trim.trimStart,
		trimEnd: trim.trimEnd,
	};
}

function VideoElementContent({ element }: { element: VideoElement }) {
	return (
		<>
			<HugeiconsIcon
				icon={Video01Icon}
				className="size-4 shrink-0 opacity-80"
			/>
			<span className="truncate">{element.name}</span>
		</>
	);
}

function ImageElementContent({
	element,
	thumbnailUrl,
}: {
	element: ImageElement;
	thumbnailUrl: string | undefined;
}) {
	if (thumbnailUrl) {
		return (
			<>
				<div
					className="size-8 shrink-0 rounded bg-cover bg-center"
					style={{ backgroundImage: `url(${thumbnailUrl})` }}
				/>
				<span className="truncate">{element.name}</span>
			</>
		);
	}

	return (
		<>
			<HugeiconsIcon icon={ImageIcon} className="size-4 shrink-0 opacity-80" />
			<span className="truncate">{element.name}</span>
		</>
	);
}

function AudioElementContent({ element }: { element: AudioElement }) {
	return (
		<>
			<HugeiconsIcon
				icon={HeadphonesIcon}
				className="size-4 shrink-0 opacity-80"
			/>
			<span className="truncate">{element.name}</span>
		</>
	);
}

function TextElementContent({ element }: { element: TextElement }) {
	return (
		<>
			<HugeiconsIcon icon={TextIcon} className="size-4 shrink-0 opacity-80" />
			<span className="truncate">{element.content || element.name}</span>
		</>
	);
}

function StickerElementContent({ element }: { element: StickerElement }) {
	const iconUrl = element.iconName
		? `https://api.iconify.design/${element.iconName}.svg?width=32&height=32`
		: undefined;

	return (
		<>
			{iconUrl ? (
				<Image
					src={iconUrl}
					alt={element.name}
					width={24}
					height={24}
					className="size-6 shrink-0 object-contain"
				/>
			) : (
				<HugeiconsIcon
					icon={Happy01Icon}
					className="size-4 shrink-0 opacity-80"
				/>
			)}
			<span className="truncate">{element.name}</span>
		</>
	);
}

function ElementContent({
	element,
	thumbnailUrl,
}: {
	element: TimelineElement;
	thumbnailUrl: string | undefined;
}) {
	if (element.type === "video") {
		return <VideoElementContent element={element} />;
	}
	if (element.type === "image") {
		return (
			<ImageElementContent element={element} thumbnailUrl={thumbnailUrl} />
		);
	}
	if (element.type === "audio") {
		return <AudioElementContent element={element} />;
	}
	if (element.type === "text") {
		return <TextElementContent element={element} />;
	}
	if (element.type === "sticker") {
		return <StickerElementContent element={element} />;
	}
	return <span className="truncate">{(element as { name: string }).name}</span>;
}

interface MobileTrackProps {
	track: TimelineTrack;
	timeToPixels: (params: { time: number }) => number;
	pixelsToTime: (params: { pixels: number }) => number;
	containerRef: React.RefObject<HTMLElement | null>;
	onDragActiveChange?: ({ active }: { active: boolean }) => void;
}

export function MobileTrack({
	track,
	timeToPixels,
	pixelsToTime,
	containerRef,
	onDragActiveChange,
}: MobileTrackProps) {
	const { isElementSelected, selectElement } = useElementSelection();
	const openDrawer = useMobileDrawerStore((s) => s.openDrawer);
	const editor = useEditor();
	const trackColor = TRACK_COLORS[track.type].background;
	const mediaAssets = editor.media.getAssets();
	const dragRef = useRef<DragState>(createInitialDragState());
	const trimRef = useRef<TrimState | null>(null);
	const [trimPreview, setTrimPreview] = useState<TrimPreview | null>(null);
	const elementRefsMap = useRef<Map<string, HTMLButtonElement>>(new Map());

	const handleTrimStart = useCallback(
		({
			event,
			element,
		}: {
			event: React.TouchEvent;
			element: TimelineElement;
		}) => {
			event.stopPropagation();
			event.preventDefault();
			const touch = event.touches[0];
			const handle = (event.currentTarget as HTMLElement).dataset
				.trimSide as "left" | "right";

			const rate =
				element.type === "video" ? (element.playbackRate ?? 1) : 1;
			const isSourceBound = element.type === "video" || element.type === "audio";
			const sourceDuration =
				isSourceBound && "mediaId" in element
					? (mediaAssets.find((a) => a.id === element.mediaId)?.duration ??
						null)
					: null;

			trimRef.current = {
				elementId: element.id,
				trackId: track.id,
				side: handle,
				startX: touch.clientX,
				startTime: element.startTime,
				duration: element.duration,
				trimStart: element.trimStart,
				trimEnd: element.trimEnd,
				rate,
				sourceDuration,
			};

			selectElement({ trackId: track.id, elementId: element.id });
		},
		[mediaAssets, selectElement, track.id],
	);

	const handleTrimMove = useCallback(
		({ event }: { event: React.TouchEvent }) => {
			const trim = trimRef.current;
			if (!trim) return;
			event.stopPropagation();

			const touch = event.touches[0];
			const deltaTime = pixelsToTime({
				pixels: touch.clientX - trim.startX,
			});
			const fps = editor.project.getActive()?.settings.fps ?? 30;

			setTrimPreview(
				computeTrim({
					trim,
					deltaTime,
					minDuration: 1 / fps,
				}),
			);
		},
		[editor.project, pixelsToTime],
	);

	const handleTrimEnd = useCallback(
		({ event }: { event: React.TouchEvent }) => {
			event.stopPropagation();
			const trim = trimRef.current;
			const preview = trimPreview;
			trimRef.current = null;
			setTrimPreview(null);
			if (!trim || !preview) return;

			// Commit through the same commands as desktop trim drags.
			editor.timeline.updateElementTrim({
				elementId: trim.elementId,
				trimStart: preview.trimStart,
				trimEnd: preview.trimEnd,
			});
			editor.timeline.updateElementStartTime({
				elements: [{ trackId: trim.trackId, elementId: trim.elementId }],
				startTime: preview.startTime,
			});
			editor.timeline.updateElementDuration({
				trackId: trim.trackId,
				elementId: trim.elementId,
				duration: preview.duration,
			});
		},
		[editor.timeline, trimPreview],
	);

	const clearLongPressTimer = useCallback(() => {
		const drag = dragRef.current;
		if (drag.longPressTimer) {
			clearTimeout(drag.longPressTimer);
			drag.longPressTimer = null;
		}
	}, []);

	const stopAutoScroll = useCallback(() => {
		const drag = dragRef.current;
		if (drag.autoScrollRaf != null) {
			cancelAnimationFrame(drag.autoScrollRaf);
			drag.autoScrollRaf = null;
		}
	}, []);

	const preventPageScroll = useCallback((e: TouchEvent) => {
		if (dragRef.current.active) {
			e.preventDefault();
		}
	}, []);

	const resetDrag = useCallback(() => {
		const drag = dragRef.current;
		clearLongPressTimer();
		stopAutoScroll();
		document.removeEventListener("touchmove", preventPageScroll);
		if (drag.elementNode) {
			drag.elementNode.style.transform = "";
			drag.elementNode.style.zIndex = "";
			drag.elementNode.style.opacity = "";
			drag.elementNode.style.boxShadow = "";
		}
		dragRef.current = createInitialDragState();
	}, [clearLongPressTimer, stopAutoScroll, preventPageScroll]);

	const runAutoScroll = useCallback(() => {
		const drag = dragRef.current;
		if (!drag.active) return;

		const container = containerRef.current;
		if (!container) return;

		const rect = container.getBoundingClientRect();
		const touchX = drag.currentTouchX;
		const distFromLeft = touchX - rect.left;
		const distFromRight = rect.right - touchX;

		let scrollDelta = 0;
		if (distFromLeft < EDGE_ZONE_PX) {
			const intensity = 1 - distFromLeft / EDGE_ZONE_PX;
			scrollDelta = -EDGE_SCROLL_SPEED * intensity;
		} else if (distFromRight < EDGE_ZONE_PX) {
			const intensity = 1 - distFromRight / EDGE_ZONE_PX;
			scrollDelta = EDGE_SCROLL_SPEED * intensity;
		}

		if (scrollDelta !== 0) {
			const currentTime = editor.playback.getCurrentTime();
			const newTime = Math.max(0, currentTime + scrollDelta);
			editor.playback.seek({ time: newTime });

			// Compensate startX so the element stays under the finger
			const pixelShift = timeToPixels({ time: Math.abs(scrollDelta) });
			if (scrollDelta > 0) {
				drag.startX -= pixelShift;
			} else {
				drag.startX += pixelShift;
			}
			drag.offsetX = drag.currentTouchX - drag.startX;

			if (drag.elementNode) {
				drag.elementNode.style.transform = `translateX(${drag.offsetX}px)`;
			}
		}

		drag.autoScrollRaf = requestAnimationFrame(runAutoScroll);
	}, [containerRef, editor.playback, timeToPixels]);

	const handleTouchStart = useCallback(
		({
			event,
			elementId,
			startTime,
		}: {
			event: React.TouchEvent;
			elementId: string;
			startTime: number;
		}) => {
			const touch = event.touches[0];
			const drag = dragRef.current;

			clearLongPressTimer();
			stopAutoScroll();
			drag.elementId = elementId;
			drag.startX = touch.clientX;
			drag.currentTouchX = touch.clientX;
			drag.offsetX = 0;
			drag.originalStartTime = startTime;
			drag.elementNode = elementRefsMap.current.get(elementId) ?? null;
			drag.active = false;
			drag.moved = false;

			drag.longPressTimer = setTimeout(() => {
				drag.active = true;
				onDragActiveChange?.({ active: true });
				navigator.vibrate?.(50);

				// Prevent page scroll while dragging
				document.addEventListener("touchmove", preventPageScroll, {
					passive: false,
				});

				if (drag.elementNode) {
					drag.elementNode.style.zIndex = "50";
					drag.elementNode.style.opacity = "0.85";
					drag.elementNode.style.boxShadow = "0 10px 25px -5px rgba(0,0,0,0.3)";
				}

				selectElement({ trackId: track.id, elementId });

				// Start edge auto-scroll loop
				drag.autoScrollRaf = requestAnimationFrame(runAutoScroll);
			}, LONG_PRESS_MS);
		},
		[
			clearLongPressTimer,
			stopAutoScroll,
			preventPageScroll,
			onDragActiveChange,
			selectElement,
			track.id,
			runAutoScroll,
		],
	);

	const handleTouchMove = useCallback(
		({ event }: { event: React.TouchEvent }) => {
			const drag = dragRef.current;
			const touch = event.touches[0];
			drag.currentTouchX = touch.clientX;
			const deltaX = touch.clientX - drag.startX;

			if (!drag.active && Math.abs(deltaX) > DRAG_MOVE_THRESHOLD) {
				clearLongPressTimer();
				drag.moved = true;
				return;
			}

			if (!drag.active) return;

			drag.offsetX = deltaX;
			drag.moved = true;

			if (drag.elementNode) {
				drag.elementNode.style.transform = `translateX(${deltaX}px)`;
			}
		},
		[clearLongPressTimer],
	);

	const handleTouchEnd = useCallback(() => {
		const drag = dragRef.current;

		if (drag.active && drag.moved && drag.elementId) {
			const timeDelta = pixelsToTime({ pixels: drag.offsetX });
			const newStartTime = Math.max(0, drag.originalStartTime + timeDelta);

			editor.timeline.moveElement({
				sourceTrackId: track.id,
				targetTrackId: track.id,
				elementId: drag.elementId,
				newStartTime,
			});
		}

		const wasDragging = drag.active;
		resetDrag();

		if (wasDragging) {
			onDragActiveChange?.({ active: false });
		}
	}, [editor.timeline, track.id, pixelsToTime, resetDrag, onDragActiveChange]);

	useEffect(() => {
		return () => {
			clearLongPressTimer();
			stopAutoScroll();
		};
	}, [clearLongPressTimer, stopAutoScroll]);

	return (
			<div className="relative w-full" style={{ height: MOBILE_TRACK_HEIGHT }}>
				{track.elements.map((element) => {
					const preview =
						trimPreview?.elementId === element.id ? trimPreview : null;
					const left = timeToPixels({
						time: preview?.startTime ?? element.startTime,
					});
					const width = timeToPixels({
						time: preview?.duration ?? element.duration,
					});
					const hasKeyframes =
						"keyframes" in element && element.keyframes !== undefined;
					const selected = isElementSelected({
						trackId: track.id,
						elementId: element.id,
					});

				const thumbnailUrl =
					element.type === "image"
						? (mediaAssets.find((a) => a.id === element.mediaId)?.url ??
							undefined)
						: undefined;

				const isVideoTrack = track.type === "video";

				return (
					<Fragment key={element.id}>
					<button
						ref={(node) => {
							if (node) {
								elementRefsMap.current.set(element.id, node);
							} else {
								elementRefsMap.current.delete(element.id);
							}
						}}
						type="button"
						className={cn(
							"absolute top-0 flex items-center gap-1.5 overflow-hidden rounded-md px-2 text-xs text-white",
							isVideoTrack ? "bg-blue-600" : trackColor,
							selected && "ring-primary ring-2",
						)}
						style={{
							left,
							width: Math.max(width, 4),
							height: MOBILE_TRACK_HEIGHT,
						}}
						onClick={() => {
							if (dragRef.current.moved) return;
							if (selected) {
								openDrawer({ drawer: "properties" });
							} else {
								selectElement({
									trackId: track.id,
									elementId: element.id,
								});
							}
						}}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								selectElement({
									trackId: track.id,
									elementId: element.id,
								});
							}
						}}
						onTouchStart={(event) => {
							event.stopPropagation();
							handleTouchStart({
								event,
								elementId: element.id,
								startTime: element.startTime,
							});
						}}
						onTouchMove={(event) => {
							handleTouchMove({ event });
						}}
						onTouchEnd={(event) => {
							event.stopPropagation();
							handleTouchEnd();
						}}
						onTouchCancel={(event) => {
							event.stopPropagation();
							handleTouchEnd();
						}}
					>
					<ElementContent element={element} thumbnailUrl={thumbnailUrl} />
						</button>

						{/* Trim handles (touch) for the selected clip. */}
						{selected && (
							<>
								<div
									data-trim-side="left"
									className="absolute top-0 z-20 flex w-8 items-center justify-center"
									style={{
										left,
										height: MOBILE_TRACK_HEIGHT,
										touchAction: "none",
									}}
									onTouchStart={(event) => handleTrimStart({ event, element })}
									onTouchMove={(event) => handleTrimMove({ event })}
									onTouchEnd={(event) => handleTrimEnd({ event })}
									onTouchCancel={(event) => handleTrimEnd({ event })}
								>
									<div className="h-6 w-1.5 rounded-full bg-white shadow-md" />
								</div>
								<div
									data-trim-side="right"
									className="absolute top-0 z-20 flex w-8 items-center justify-center"
									style={{
										left: left + Math.max(width, 4) - 32,
										height: MOBILE_TRACK_HEIGHT,
										touchAction: "none",
									}}
									onTouchStart={(event) => handleTrimStart({ event, element })}
									onTouchMove={(event) => handleTrimMove({ event })}
									onTouchEnd={(event) => handleTrimEnd({ event })}
									onTouchCancel={(event) => handleTrimEnd({ event })}
								>
									<div className="h-6 w-1.5 rounded-full bg-white shadow-md" />
								</div>
							</>
						)}

						{/* Keyframe diamonds overlay (mobile: click-to-seek only). */}
						{hasKeyframes && (
							<div
								className="pointer-events-none absolute top-0"
								style={{
									left,
									width: Math.max(width, 4),
									height: MOBILE_TRACK_HEIGHT,
								}}
							>
								<KeyframeDiamonds
									element={element}
									trackId={track.id}
									zoomLevel={1}
									pxPerSecond={timeToPixels({ time: 1 }) - timeToPixels({ time: 0 })}
									interaction="mobile"
								/>
							</div>
						)}
					</Fragment>
				);
				})}
		</div>
	);
}
