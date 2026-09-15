import { useState, useCallback, type RefObject } from "react";
import { useEditor } from "@/hooks/use-editor";
import { processMediaAssets } from "@/lib/media/processing";
import { toast } from "sonner";
import { TIMELINE_CONSTANTS } from "@/constants/timeline-constants";
import { snapTimeToFrame } from "@/lib/time";
import {
	buildTextElement,
	buildStickerElement,
	buildUploadAudioElement,
	buildVideoElement,
	buildImageElement,
	buildBlurEffectElement,
	buildAdjustmentElement,
} from "@/lib/timeline/element-utils";
import { computeDropTarget } from "@/lib/timeline/drop-utils";
import { isMainTrack } from "@/lib/timeline/track-utils";
import { useTimelineSnapping } from "@/hooks/timeline/use-timeline-snapping";
import { getDragData, hasDragData } from "@/lib/drag-data";
import { useTimelineStore } from "@/stores/timeline-store";
import type { TrackType, DropTarget, ElementType } from "@/types/timeline";
import type {
	MediaDragData,
	StickerDragData,
	BlurEffectDragData,
	AdjustmentDragData,
} from "@/types/drag";

interface UseTimelineDragDropProps {
	containerRef: RefObject<HTMLDivElement | null>;
	headerRef?: RefObject<HTMLElement | null>;
	zoomLevel: number;
}

export function useTimelineDragDrop({
	containerRef,
	headerRef,
	zoomLevel,
}: UseTimelineDragDropProps) {
	const editor = useEditor();
	const [isDragOver, setIsDragOver] = useState(false);
	const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
	const [dragElementType, setElementType] = useState<ElementType | null>(null);
	const [dropDuration, setDropDuration] = useState(0);
	const [isDropSnapped, setIsDropSnapped] = useState(false);

	const tracks = editor.timeline.getTracks();
	const currentTime = editor.playback.getCurrentTime();
	const mediaAssets = editor.media.getAssets();
	const activeProject = editor.project.getActive();

	const { snapElementEdge } = useTimelineSnapping();

	const getSnappedTime = useCallback(
		({ time }: { time: number }) => {
			const projectFps = activeProject.settings.fps;
			return snapTimeToFrame({ time, fps: projectFps });
		},
		[activeProject.settings.fps],
	);

	/**
	 * Snap a drop position to nearby element edges and the playhead, the
	 * same way in-timeline element drags snap, so dropped clips butt against
	 * neighbours instead of leaving sub-pixel gaps. Honours the Auto
	 * snapping toolbar toggle.
	 */
	const snapDropPosition = useCallback(
		({
			time,
			duration,
			tracks: snapTracks,
		}: {
			time: number;
			duration: number;
			tracks: ReturnType<typeof editor.timeline.getTracks>;
		}): { time: number; snapped: boolean } => {
			if (!useTimelineStore.getState().snappingEnabled) {
				return { time, snapped: false };
			}

			const startSnap = snapElementEdge({
				targetTime: time,
				elementDuration: duration,
				tracks: snapTracks,
				playheadTime: currentTime,
				zoomLevel,
			});
			const endSnap = snapElementEdge({
				targetTime: time,
				elementDuration: duration,
				tracks: snapTracks,
				playheadTime: currentTime,
				zoomLevel,
				snapToStart: false,
			});

			const best =
				startSnap.snapDistance <= endSnap.snapDistance ? startSnap : endSnap;
			if (!best.snapPoint) {
				return { time, snapped: false };
			}

			return { time: Math.max(0, best.snappedTime), snapped: true };
		},
		[snapElementEdge, currentTime, zoomLevel],
	);

	/**
	 * Ripple editing ON: a video/image dropped on the main track beyond the
	 * end of its clip sequence (or into a gap too small for it) lands flush
	 * at the sequence end instead of staying put and leaving a gap. A drop
	 * that fits an interior gap keeps its position — the drop target only
	 * resolves to the main track when the clip fits there anyway, and edge
	 * snapping butts it against the gap edge. Overlay tracks (text/sticker/
	 * PiP) keep the dropped position — gaps there are intentional.
	 */
	const applyRippleAppend = useCallback(
		({
			target,
			elementType,
			elementDuration,
			tracks: currentTracks,
		}: {
			target: DropTarget;
			elementType: ElementType;
			elementDuration: number;
			tracks: ReturnType<typeof editor.timeline.getTracks>;
		}): { target: DropTarget; rippled: boolean } => {
			if (!useTimelineStore.getState().rippleEditingEnabled) {
				return { target, rippled: false };
			}
			if (elementType !== "video" && elementType !== "image") {
				return { target, rippled: false };
			}
			if (target.isNewTrack) return { target, rippled: false };

			const track = currentTracks[target.trackIndex];
			if (!track || !isMainTrack(track)) {
				return { target, rippled: false };
			}

			const lastEnd = track.elements.reduce(
				(end, element) => Math.max(end, element.startTime + element.duration),
				0,
			);
			if (target.xPosition + elementDuration <= lastEnd) {
				// Fits inside the existing span (an interior gap) — keep it.
				return { target, rippled: false };
			}

			return { target: { ...target, xPosition: lastEnd }, rippled: true };
		},
		[],
	);

	const getElementType = useCallback(
		({ dataTransfer }: { dataTransfer: DataTransfer }): ElementType | null => {
			const dragData = getDragData({ dataTransfer });
			if (!dragData) return null;

			if (dragData.type === "text") return "text";
			if (dragData.type === "sticker") return "sticker";
			if (dragData.type === "blur-effect") return "blur-effect";
			if (dragData.type === "adjustment") return "adjustment";
			if (dragData.type === "media") {
				return dragData.mediaType;
			}
			return null;
		},
		[],
	);

	const getElementDuration = useCallback(
		({
			elementType,
			mediaId,
		}: {
			elementType: ElementType;
			mediaId?: string;
		}): number => {
			if (
				elementType === "text" ||
				elementType === "sticker" ||
				elementType === "blur-effect" ||
				elementType === "adjustment"
			) {
				return TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
			}
			if (mediaId) {
				const media = mediaAssets.find((m) => m.id === mediaId);
				return media?.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
			}
			return TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
		},
		[mediaAssets],
	);

	const handleDragEnter = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		const hasAsset = hasDragData({ dataTransfer: e.dataTransfer });
		const hasFiles = e.dataTransfer.types.includes("Files");
		if (!hasAsset && !hasFiles) return;
		setIsDragOver(true);
	}, []);

	const handleDragOver = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();

			const rect = containerRef.current?.getBoundingClientRect();
			if (!rect) return;

			const headerHeight =
				headerRef?.current?.getBoundingClientRect().height ?? 0;
			const hasFiles = e.dataTransfer.types.includes("Files");
			const isExternal =
				hasFiles && !hasDragData({ dataTransfer: e.dataTransfer });

			const elementType = getElementType({ dataTransfer: e.dataTransfer });

			if (!elementType && hasFiles && isExternal) {
				setDropTarget(null);
				setElementType(null);
				return;
			}

			if (!elementType) return;

			setElementType(elementType);

			const dragData = getDragData({ dataTransfer: e.dataTransfer });
			const duration = getElementDuration({
				elementType,
				mediaId: dragData?.type === "media" ? dragData.id : undefined,
			});

			const mouseX = e.clientX - rect.left;
			const mouseY = Math.max(0, e.clientY - rect.top - headerHeight);

			const target = computeDropTarget({
				elementType,
				mouseX,
				mouseY,
				tracks,
				playheadTime: currentTime,
				isExternalDrop: isExternal,
				elementDuration: duration,
				pixelsPerSecond: TIMELINE_CONSTANTS.PIXELS_PER_SECOND,
				zoomLevel,
				snappingEnabled: useTimelineStore.getState().snappingEnabled,
			});

			const rippleResult = applyRippleAppend({
				target,
				elementType,
				elementDuration: duration,
				tracks,
			});
			let snapped = false;
			let dropTime = rippleResult.target.xPosition;
			if (rippleResult.rippled) {
				// Ripple already resolved the position flush to the sequence
				// end; edge snapping would only fight it.
				snapped = true;
			} else {
				const snapResult = snapDropPosition({
					time: dropTime,
					duration,
					tracks,
				});
				dropTime = snapResult.time;
				snapped = snapResult.snapped;
			}
			target.xPosition = getSnappedTime({ time: dropTime });
			setDropDuration(duration);
			setIsDropSnapped(snapped);

			setDropTarget(target);
			e.dataTransfer.dropEffect = "copy";
		},
		[
			containerRef,
			headerRef,
			tracks,
			currentTime,
			zoomLevel,
			getElementType,
			getElementDuration,
			getSnappedTime,
			snapDropPosition,
			applyRippleAppend,
		],
	);

	const handleDragLeave = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			const rect = containerRef.current?.getBoundingClientRect();
			if (rect) {
				const { clientX, clientY } = e;
				if (
					clientX < rect.left ||
					clientX > rect.right ||
					clientY < rect.top ||
					clientY > rect.bottom
				) {
					setIsDragOver(false);
					setDropTarget(null);
					setElementType(null);
					setDropDuration(0);
					setIsDropSnapped(false);
				}
			}
		},
		[containerRef],
	);

	const executeTextDrop = useCallback(
		({
			target,
			dragData,
		}: {
			target: DropTarget;
			dragData: {
				name?: string;
				content?: string;
				styles?: Record<string, unknown>;
			};
		}) => {
			let trackId: string;

			if (target.isNewTrack) {
				trackId = editor.timeline.addTrack({
					type: "text",
					index: target.trackIndex,
				});
			} else {
				const track = tracks[target.trackIndex];
				if (!track) return;
				trackId = track.id;
			}

			const element = buildTextElement({
				raw: {
					name: dragData.name ?? "",
					content: dragData.content ?? "",
					...(dragData.styles ?? {}),
				},
				startTime: target.xPosition,
			});

			editor.timeline.insertElement({
				placement: { mode: "explicit", trackId },
				element,
			});
		},
		[editor.timeline, tracks],
	);

	const executeStickerDrop = useCallback(
		({
			target,
			dragData,
		}: {
			target: DropTarget;
			dragData: StickerDragData;
		}) => {
			let trackId: string;

			if (target.isNewTrack) {
				trackId = editor.timeline.addTrack({
					type: "sticker",
					index: target.trackIndex,
				});
			} else {
				const track = tracks[target.trackIndex];
				if (!track) return;
				trackId = track.id;
			}

			const element = buildStickerElement({
				iconName: dragData.iconName,
				startTime: target.xPosition,
			});

			editor.timeline.insertElement({
				placement: { mode: "explicit", trackId },
				element,
			});
		},
		[editor.timeline, tracks],
	);

	const executeBlurEffectDrop = useCallback(
		({
			target,
			dragData,
		}: {
			target: DropTarget;
			dragData: BlurEffectDragData;
		}) => {
			let trackId: string;

			if (target.isNewTrack) {
				trackId = editor.timeline.addTrack({
					type: "effect",
					index: target.trackIndex,
				});
			} else {
				const track = tracks[target.trackIndex];
				if (!track) return;
				trackId = track.id;
			}

			const element = buildBlurEffectElement({
				blurIntensity: dragData.blurIntensity,
				startTime: target.xPosition,
			});

			editor.timeline.insertElement({
				placement: { mode: "explicit", trackId },
				element,
			});
		},
		[editor.timeline, tracks],
	);

	const executeAdjustmentDrop = useCallback(
		({ target }: { target: DropTarget; dragData: AdjustmentDragData }) => {
			let trackId: string;

			if (target.isNewTrack) {
				trackId = editor.timeline.addTrack({
					type: "adjustment",
					index: target.trackIndex,
				});
			} else {
				const track = tracks[target.trackIndex];
				if (!track) return;
				trackId = track.id;
			}

			const element = buildAdjustmentElement({
				startTime: target.xPosition,
			});

			editor.timeline.insertElement({
				placement: { mode: "explicit", trackId },
				element,
			});
		},
		[editor.timeline, tracks],
	);

	const executeMediaDrop = useCallback(
		({ target, dragData }: { target: DropTarget; dragData: MediaDragData }) => {
			const mediaAsset = mediaAssets.find((m) => m.id === dragData.id);
			if (!mediaAsset) return;

			const trackType: TrackType =
				dragData.mediaType === "audio" ? "audio" : "video";
			let trackId: string;

			if (target.isNewTrack) {
				trackId = editor.timeline.addTrack({
					type: trackType,
					index: target.trackIndex,
				});
			} else {
				const track = tracks[target.trackIndex];
				if (!track) return;
				trackId = track.id;
			}

			const duration =
				mediaAsset.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;

			if (dragData.mediaType === "audio") {
				editor.timeline.insertElement({
					placement: { mode: "explicit", trackId },
					element: buildUploadAudioElement({
						mediaId: mediaAsset.id,
						name: mediaAsset.name,
						duration,
						startTime: target.xPosition,
					}),
				});
			} else if (dragData.mediaType === "video") {
				editor.timeline.insertElement({
					placement: { mode: "explicit", trackId },
					element: buildVideoElement({
						mediaId: mediaAsset.id,
						name: mediaAsset.name,
						duration,
						startTime: target.xPosition,
					}),
				});
			} else {
				editor.timeline.insertElement({
					placement: { mode: "explicit", trackId },
					element: buildImageElement({
						mediaId: mediaAsset.id,
						name: mediaAsset.name,
						duration,
						startTime: target.xPosition,
					}),
				});
			}
		},
		[editor.timeline, mediaAssets, tracks],
	);

	const executeFileDrop = useCallback(
		async ({
			files,
			mouseX,
			mouseY,
		}: {
			files: File[];
			mouseX: number;
			mouseY: number;
		}) => {
			if (!activeProject) return;

			const processedAssets = await processMediaAssets({ files });

			for (const asset of processedAssets) {
				await editor.media.addMediaAsset({
					projectId: activeProject.metadata.id,
					asset,
				});

				const added = editor.media
					.getAssets()
					.find((m) => m.name === asset.name && m.url === asset.url);

				if (added) {
					const duration =
						added.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
					const currentTracks = editor.timeline.getTracks();
					const dropTarget = computeDropTarget({
						elementType: added.type,
						mouseX,
						mouseY,
						tracks: currentTracks,
						playheadTime: currentTime,
						isExternalDrop: true,
						elementDuration: duration,
						pixelsPerSecond: TIMELINE_CONSTANTS.PIXELS_PER_SECOND,
						zoomLevel,
						snappingEnabled: useTimelineStore.getState().snappingEnabled,
					});
					const rippleResult = applyRippleAppend({
						target: dropTarget,
						elementType: added.type,
						elementDuration: duration,
						tracks: currentTracks,
					});
					dropTarget.xPosition = getSnappedTime({
						time: rippleResult.rippled
							? rippleResult.target.xPosition
							: snapDropPosition({
									time: dropTarget.xPosition,
									duration,
									tracks: currentTracks,
								}).time,
					});

					const trackType: TrackType =
						added.type === "audio" ? "audio" : "video";
					const trackId = dropTarget.isNewTrack
						? editor.timeline.addTrack({
								type: trackType,
								index: dropTarget.trackIndex,
							})
						: currentTracks[dropTarget.trackIndex]?.id;

					if (!trackId) return;

					if (added.type === "audio") {
						editor.timeline.insertElement({
							placement: { mode: "explicit", trackId },
							element: buildUploadAudioElement({
								mediaId: added.id,
								name: added.name,
								duration,
								startTime: dropTarget.xPosition,
								buffer: new AudioBuffer({ length: 1, sampleRate: 44100 }),
							}),
						});
					} else if (added.type === "video") {
						editor.timeline.insertElement({
							placement: { mode: "explicit", trackId },
							element: buildVideoElement({
								mediaId: added.id,
								name: added.name,
								duration,
								startTime: dropTarget.xPosition,
							}),
						});
					} else {
						editor.timeline.insertElement({
							placement: { mode: "explicit", trackId },
							element: buildImageElement({
								mediaId: added.id,
								name: added.name,
								duration,
								startTime: dropTarget.xPosition,
							}),
						});
					}
				}
			}
		},
		[
			activeProject,
			editor.media,
			editor.timeline,
			currentTime,
			zoomLevel,
			getSnappedTime,
			snapDropPosition,
			applyRippleAppend,
		],
	);

	const handleDrop = useCallback(
		async (e: React.DragEvent) => {
			e.preventDefault();

			const hasAsset = hasDragData({ dataTransfer: e.dataTransfer });
			const hasFiles = e.dataTransfer.files?.length > 0;

			if (!hasAsset && !hasFiles) return;

			const currentTarget = dropTarget;
			setIsDragOver(false);
			setDropTarget(null);
			setElementType(null);
			setDropDuration(0);
			setIsDropSnapped(false);

			try {
				if (hasAsset) {
					if (!currentTarget) return;
					const dragData = getDragData({ dataTransfer: e.dataTransfer });
					if (!dragData) return;

					if (dragData.type === "text") {
						executeTextDrop({ target: currentTarget, dragData });
					} else if (dragData.type === "sticker") {
						executeStickerDrop({ target: currentTarget, dragData });
					} else if (dragData.type === "blur-effect") {
						executeBlurEffectDrop({ target: currentTarget, dragData });
					} else if (dragData.type === "adjustment") {
						executeAdjustmentDrop({ target: currentTarget, dragData });
					} else {
						executeMediaDrop({ target: currentTarget, dragData });
					}
				} else if (hasFiles) {
					const rect = containerRef.current?.getBoundingClientRect();
					if (!rect) return;
					const mouseX = e.clientX - rect.left;
					const headerHeight =
						headerRef?.current?.getBoundingClientRect().height ?? 0;
					const mouseY = Math.max(0, e.clientY - rect.top - headerHeight);
					await executeFileDrop({
						files: Array.from(e.dataTransfer.files),
						mouseX,
						mouseY,
					});
				}
			} catch (err) {
				console.error("Failed to process drop:", err);
				toast.error("Failed to process drop");
			}
		},
		[
			dropTarget,
			executeTextDrop,
			executeStickerDrop,
			executeBlurEffectDrop,
			executeAdjustmentDrop,
			executeMediaDrop,
			executeFileDrop,
			containerRef,
			headerRef,
		],
	);

	return {
		isDragOver,
		dropTarget,
		dragElementType,
		dropDuration,
		isDropSnapped,
		dragProps: {
			onDragEnter: handleDragEnter,
			onDragOver: handleDragOver,
			onDragLeave: handleDragLeave,
			onDrop: handleDrop,
		},
	};
}
