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
import { invokeAction } from "@/lib/actions";
import { PauseIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/utils/ui";

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
								: activeProject.settings.background.color,
				}}
			/>
		</div>
	);
}

export function MobilePreview() {
	const editor = useEditor();
	const isPlaying = editor.playback.getIsPlaying();

	const handleTogglePlay = useCallback(() => {
		invokeAction("toggle-play");
	}, []);

	return (
		<div className="relative flex min-h-[30vh] flex-1 items-center justify-center bg-black">
			<MobilePreviewCanvas />
			<MobileRenderTreeController />

			{/* Tap overlay to toggle play/pause */}
			<button
				type="button"
				className="absolute inset-0 z-10 flex items-center justify-center"
				onClick={handleTogglePlay}
				onKeyDown={({ key }) => {
					if (key === "Enter" || key === " ") {
						handleTogglePlay();
					}
				}}
				aria-label={isPlaying ? "Pause" : "Play"}
			>
				<div
					className={cn(
						"flex size-14 items-center justify-center rounded-full bg-black/50 text-white transition-opacity duration-200",
						isPlaying && "pointer-events-none opacity-0",
					)}
				>
					<HugeiconsIcon
						icon={isPlaying ? PauseIcon : PlayIcon}
						className="size-7"
					/>
				</div>
			</button>
		</div>
	);
}
