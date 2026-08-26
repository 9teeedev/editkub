"use client";

import { useRef, useCallback } from "react";
import { useEditor } from "@/hooks/use-editor";
import { useRafLoop } from "@/hooks/use-raf-loop";
import { invokeAction } from "@/lib/actions";
import { useTimelineScroll } from "../hooks/use-timeline-scroll";
import { useTouchGestures } from "../hooks/use-touch-gestures";
import { useMobileDrawerStore } from "../hooks/use-mobile-drawer";
import { MobileTrack } from "./mobile-track";
import { MobilePlayhead } from "./mobile-playhead";
import { TimelineTick } from "../../panels/timeline/timeline-tick";
import { getRulerConfig } from "@/lib/timeline/ruler-utils";
import { EditableTimecode } from "@/components/editable-timecode";
import { formatTimeCode } from "@/lib/time";
import { cn } from "@/utils/ui";
import {
	Backward01Icon,
	FullScreenIcon,
	PauseIcon,
	PlayIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";

const TIMELINE_MIN_HEIGHT = 180;
const RULER_HEIGHT = 20;
const CONTENT_END_PADDING_SECONDS = 2;

export function MobileTimeline() {
	const editor = useEditor();
	const containerRef = useRef<HTMLElement>(null);
	const translateXRef = useRef(0);
	const contentRef = useRef<HTMLDivElement>(null);
	const rulerInnerRef = useRef<HTMLDivElement>(null);
	const isDraggingElementRef = useRef(false);

	const { zoomLevel, timeToPixels, pixelsToTime, handlePan, handlePinch } =
		useTimelineScroll();
	const closeDrawer = useMobileDrawerStore((s) => s.closeDrawer);

	const handleDragActiveChange = useCallback(
		({ active }: { active: boolean }) => {
			isDraggingElementRef.current = active;
		},
		[],
	);

	const getScrollX = useCallback(() => {
		const currentTime = editor.playback.getCurrentTime();
		const containerWidth = containerRef.current?.clientWidth ?? 0;
		return timeToPixels({ time: currentTime }) - containerWidth / 2;
	}, [editor, timeToPixels]);

	const getContentWidth = useCallback(() => {
		const duration = editor.timeline.getTotalDuration();
		const totalTime = duration + CONTENT_END_PADDING_SECONDS;
		return timeToPixels({ time: totalTime });
	}, [editor, timeToPixels]);

	// RAF loop keeps the translateX in sync with playback time
	useRafLoop(
		useCallback(() => {
			const scrollX = getScrollX();
			// Only write to DOM when value actually changed (avoid layout thrash)
			if (scrollX !== translateXRef.current) {
				translateXRef.current = scrollX;
				const transform = `translateX(${-scrollX}px)`;
				if (contentRef.current) {
					contentRef.current.style.transform = transform;
				}
				if (rulerInnerRef.current) {
					rulerInnerRef.current.style.transform = transform;
				}
			}
		}, [getScrollX]),
	);

	const guardedHandlePan = useCallback(
		({ deltaX }: { deltaX: number; deltaY: number }) => {
			if (isDraggingElementRef.current) return;
			handlePan({ deltaX });
		},
		[handlePan],
	);

	const guardedHandlePinch = useCallback(
		(params: { scale: number; centerX: number; centerY: number }) => {
			if (isDraggingElementRef.current) return;
			handlePinch(params);
		},
		[handlePinch],
	);

	useTouchGestures({
		ref: containerRef,
		handlers: {
			onPan: guardedHandlePan,
			onPinch: guardedHandlePinch,
			onTap: () => {
				if (isDraggingElementRef.current) return;
				editor.selection.clearSelection();
				closeDrawer();
			},
		},
	});

	const tracks = editor.timeline.getTracks();
	const contentWidth = getContentWidth();
	const currentTime = editor.playback.getCurrentTime();
	const totalDuration = editor.timeline.getTotalDuration();
	const isPlaying = editor.playback.getIsPlaying();
	const fps = editor.project.getActive()?.settings.fps ?? 30;
	const { t } = useTranslation();

	const handlePlayPause = useCallback(() => {
		invokeAction("toggle-play");
	}, []);

	const handleBackToStart = useCallback(() => {
		editor.playback.seek({ time: 0 });
	}, [editor.playback]);

	const handleFullscreen = useCallback(() => {
		const previewEl = document.querySelector("[data-preview-container]");
		if (previewEl instanceof HTMLElement) {
			previewEl.requestFullscreen();
		}
	}, []);

	return (
		<section
			ref={containerRef}
			className={cn(
				"bg-background relative flex min-h-0 flex-1 flex-col overflow-hidden border-t",
				"touch-none select-none",
			)}
			style={{ minHeight: TIMELINE_MIN_HEIGHT }}
			aria-label="Timeline"
		>
			{/* Timecode + playback controls */}
			<div className="text-muted-foreground flex h-8 flex-none items-center gap-1 px-1 text-[11px] tabular-nums">
				<div className="flex min-w-0 items-center gap-1 px-1">
					<EditableTimecode
						time={currentTime}
						duration={totalDuration}
						format="MM:SS"
						fps={fps}
						onTimeChange={({ time }) => editor.playback.seek({ time })}
						className="text-foreground"
					/>
					<span>/</span>
					<span>
						{formatTimeCode({
							timeInSeconds: totalDuration,
							format: "MM:SS",
							fps,
						})}
					</span>
				</div>

				<div className="ml-auto flex items-center">
					<ControlButton
						icon={Backward01Icon}
						label={t("Back to start")}
						onClick={handleBackToStart}
					/>
					<ControlButton
						icon={isPlaying ? PauseIcon : PlayIcon}
						label={isPlaying ? t("Pause") : t("Play")}
						onClick={handlePlayPause}
						highlight
					/>
					<ControlButton
						icon={FullScreenIcon}
						label={t("Enter fullscreen")}
						onClick={handleFullscreen}
					/>
				</div>
			</div>

			{/* Ruler strip — its own translated layer, synced by the RAF loop */}
			<div
				className="relative flex-none overflow-hidden"
				style={{ height: RULER_HEIGHT }}
				aria-hidden
			>
				<div
					ref={rulerInnerRef}
					className="absolute top-0 left-0 h-full"
					style={{
						width: contentWidth,
						willChange: "transform",
					}}
				>
					{renderRulerTicks({
						totalTime: totalDuration + CONTENT_END_PADDING_SECONDS,
						zoomLevel,
						fps,
					})}
				</div>
			</div>

			{/* Scrollable content layer */}
			<div
				ref={contentRef}
				className="relative min-h-0 flex-1 overflow-y-auto overflow-x-visible"
				style={{
					width: contentWidth,
					willChange: "transform",
				}}
			>
				<div className="flex flex-col pb-2">
					{tracks.map((track, index) => (
						<div key={track.id}>
							{index > 0 && <div className="bg-border mx-2 h-px" />}
							<MobileTrack
								track={track}
								timeToPixels={timeToPixels}
								pixelsToTime={pixelsToTime}
								containerRef={containerRef}
								onDragActiveChange={handleDragActiveChange}
							/>
						</div>
					))}
				</div>
			</div>

			{/* Centered playhead overlay */}
			<MobilePlayhead />
		</section>
	);
}

function renderRulerTicks({
	totalTime,
	zoomLevel,
	fps,
}: {
	totalTime: number;
	zoomLevel: number;
	fps: number;
}) {
	const { labelIntervalSeconds, tickIntervalSeconds } = getRulerConfig({
		zoomLevel,
		fps,
	});

	const tickCount = Math.floor(totalTime / tickIntervalSeconds);
	const ticks = [];
	for (let i = 0; i <= tickCount; i++) {
		const time = i * tickIntervalSeconds;
		const isLabel =
			Math.abs(time / labelIntervalSeconds - Math.round(time / labelIntervalSeconds)) <
			1e-6;
		ticks.push(
			<TimelineTick
				key={i}
				time={time}
				zoomLevel={zoomLevel}
				fps={fps}
				showLabel={isLabel}
			/>,
		);
	}
	return ticks;
}

/** Compact icon button for the mobile timeline control row. */
function ControlButton({
	icon,
	label,
	onClick,
	highlight,
}: {
	icon: Parameters<typeof HugeiconsIcon>[0]["icon"];
	label: string;
	onClick: () => void;
	highlight?: boolean;
}) {
	return (
		<button
			type="button"
			className={cn(
				"flex size-8 items-center justify-center rounded-md transition-colors active:bg-muted",
				highlight ? "text-foreground" : "text-muted-foreground",
			)}
			onClick={(event) => {
				event.stopPropagation();
				onClick();
			}}
			onTouchStart={(event) => event.stopPropagation()}
			onTouchEnd={(event) => event.stopPropagation()}
			aria-label={label}
		>
			<HugeiconsIcon icon={icon} className="size-4" />
		</button>
	);
}
