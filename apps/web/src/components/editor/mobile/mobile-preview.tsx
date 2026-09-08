"use client";

import { useCallback, useMemo, useRef } from "react";
import useDeepCompareEffect from "use-deep-compare-effect";
import { useEditor } from "@/hooks/use-editor";
import { useRafLoop } from "@/hooks/use-raf-loop";
import { useContainerSize } from "@/hooks/use-container-size";
import { CanvasRenderer } from "@/services/renderer/canvas-renderer";
import type { RootNode } from "@/services/renderer/nodes/root-node";
import { buildScene } from "@/services/renderer/scene-builder";
import { getLastFrameTime } from "@/lib/time";
import { PreviewInteractionOverlay } from "../panels/preview/preview-interaction-overlay";
import { LayoutGuideOverlay } from "../layout-guide-overlay";
import { useEditorStore } from "@/stores/editor-store";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";
import { SmartPhone01Icon } from "@hugeicons/core-free-icons";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { invokeAction } from "@/lib/actions";
import { PauseIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/utils/ui";

const TRANSPARENT_BACKGROUND =
	"repeating-conic-gradient(#e5e7eb 0% 25%, #9ca3af 0% 50%) 50% / 16px 16px";

function usePreviewSize() {
	const editor = useEditor();
	const activeProject = editor.project.getActive();

	return {
		width: activeProject?.settings.canvasSize.width,
		height: activeProject?.settings.canvasSize.height,
	};
}

function MobileRenderTreeController() {
	const editor = useEditor();
	const tracks = editor.timeline.getTracks();
	const mediaAssets = editor.media.getAssets();
	const activeProject = editor.project.getActive();

	const { width, height } = usePreviewSize();

	useDeepCompareEffect(() => {
		if (!activeProject) return;

		const duration = editor.timeline.getTotalDuration();
		const renderTree = buildScene({
			tracks,
			mediaAssets,
			duration,
			canvasSize: { width, height },
			background: activeProject.settings.background,
		});

		editor.renderer.setRenderTree({ renderTree });
	}, [tracks, mediaAssets, activeProject?.settings.background, width, height]);

	return null;
}

function MobilePreviewCanvas() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const lastFrameRef = useRef(-1);
	const lastSceneRef = useRef<RootNode | null>(null);
	const renderingRef = useRef(false);
	const { width: nativeWidth, height: nativeHeight } = usePreviewSize();
	const containerSize = useContainerSize({ containerRef });
	const editor = useEditor();
	const activeProject = editor.project.getActive();

	const renderer = useMemo(() => {
		return new CanvasRenderer({
			width: nativeWidth,
			height: nativeHeight,
			fps: activeProject.settings.fps,
		});
	}, [nativeWidth, nativeHeight, activeProject.settings.fps]);

	const displaySize = useMemo(() => {
		if (
			!nativeWidth ||
			!nativeHeight ||
			containerSize.width === 0 ||
			containerSize.height === 0
		) {
			return { width: nativeWidth ?? 0, height: nativeHeight ?? 0 };
		}

		const paddingBuffer = 4;
		const availableWidth = containerSize.width - paddingBuffer;
		const availableHeight = containerSize.height - paddingBuffer;

		const aspectRatio = nativeWidth / nativeHeight;
		const containerAspect = availableWidth / availableHeight;

		const displayWidth =
			containerAspect > aspectRatio
				? availableHeight * aspectRatio
				: availableWidth;
		const displayHeight =
			containerAspect > aspectRatio
				? availableHeight
				: availableWidth / aspectRatio;

		return { width: displayWidth, height: displayHeight };
	}, [nativeWidth, nativeHeight, containerSize.width, containerSize.height]);

	const renderTree = editor.renderer.getRenderTree();

	const render = useCallback(() => {
		if (canvasRef.current && renderTree && !renderingRef.current) {
			const time = editor.playback.getCurrentTime();
			const lastFrameTime = getLastFrameTime({
				duration: renderTree.duration,
				fps: renderer.fps,
			});
			const renderTime = Math.min(time, lastFrameTime);
			const frame = Math.floor(renderTime * renderer.fps);

			if (
				frame !== lastFrameRef.current ||
				renderTree !== lastSceneRef.current
			) {
				renderingRef.current = true;
				lastSceneRef.current = renderTree;
				lastFrameRef.current = frame;
				renderer
					.renderToCanvas({
						node: renderTree,
						time: renderTime,
						targetCanvas: canvasRef.current,
					})
					.then(() => {
						renderingRef.current = false;
					});
			}
		}
	}, [renderer, renderTree, editor.playback]);

	useRafLoop(render);

	return (
		<div
			ref={containerRef}
			className="relative flex h-full w-full items-center justify-center"
		>
			{/* Sized wrapper: overlays mount against the exact canvas rect,
			    same structure as the desktop preview panel. */}
			<div
				className="relative"
				style={{ width: displaySize.width, height: displaySize.height }}
			>
				<canvas
					ref={canvasRef}
					width={nativeWidth}
					height={nativeHeight}
					className="block"
					style={{
						width: displaySize.width,
						height: displaySize.height,
						background:
							activeProject.settings.background.type === "blur"
								? "transparent"
								: activeProject.settings.background.type === "gradient"
									? activeProject.settings.background.css
									: activeProject.settings.background.color === "transparent"
										? TRANSPARENT_BACKGROUND
										: activeProject.settings.background.color,
					}}
				/>
				<LayoutGuideOverlay />
				<PreviewInteractionOverlay
					canvasRef={canvasRef}
					displaySize={displaySize}
				/>
			</div>
		</div>
	);
}

export function MobilePreview() {
	const editor = useEditor();
	const { t } = useTranslation();
	const isPlaying = editor.playback.getIsPlaying();
	const { selectedElements } = useElementSelection();
	const layoutGuidePlatform = useEditorStore((s) => s.layoutGuide.platform);
	const toggleLayoutGuide = useEditorStore((s) => s.toggleLayoutGuide);
	const { width: canvasWidth, height: canvasHeight } = usePreviewSize();

	const handleTogglePlay = useCallback(() => {
		invokeAction("toggle-play");
	}, []);

	// The full-area play button only exists when it cannot fight the
	// interaction overlay: paused AND nothing selected. Tap empty canvas to
	// clear the selection and bring it back.
	const showPlayButton = !isPlaying && selectedElements.length === 0;

	// The preview region wraps the canvas aspect (CapCut-style) instead of
	// taking all leftover height: a landscape video on a portrait phone sits
	// right under the header and the timeline absorbs the freed space. Flex
	// shrink still lets a portrait canvas consume the full column.
	const hasCanvas = !!canvasWidth && !!canvasHeight;

	return (
		<div
			data-preview-container
			className="bg-background relative flex w-full items-center justify-center"
			style={
				hasCanvas
					? {
							aspectRatio: `${canvasWidth} / ${canvasHeight}`,
							minHeight: 120,
						}
					: { minHeight: "30vh" }
			}
		>
			<div className="absolute inset-0 flex items-center justify-center bg-black">
				<MobilePreviewCanvas />
			</div>
			<MobileRenderTreeController />

			{/* Floating safe-zone toggle (top-right, above every overlay) */}
			<button
				type="button"
				className={cn(
					"absolute top-2 right-2 z-[1200] flex size-9 items-center justify-center rounded-full backdrop-blur-sm transition-colors",
					layoutGuidePlatform === "tiktok"
						? "bg-primary text-primary-foreground"
						: "bg-black/50 text-white",
				)}
				onClick={() => toggleLayoutGuide("tiktok")}
				aria-pressed={layoutGuidePlatform === "tiktok"}
				aria-label={t("TikTok safe zone")}
			>
				<HugeiconsIcon icon={SmartPhone01Icon} className="size-4" />
			</button>

			{/* Tap overlay to toggle play/pause */}
			<button
				type="button"
				className={cn(
					"absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-150",
					!showPlayButton && "pointer-events-none opacity-0",
				)}
				onClick={handleTogglePlay}
				onKeyDown={({ key }) => {
					if (key === "Enter" || key === " ") {
						handleTogglePlay();
					}
				}}
				aria-label={isPlaying ? "Pause" : "Play"}
				aria-hidden={!showPlayButton}
				tabIndex={showPlayButton ? 0 : -1}
			>
				<div className="flex size-14 items-center justify-center rounded-full bg-black/50 text-white">
					<HugeiconsIcon
						icon={isPlaying ? PauseIcon : PlayIcon}
						className="size-7"
					/>
				</div>
			</button>
		</div>
	);
}
