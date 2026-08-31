import type {
	TimelineTrack,
	VideoElement,
	ImageElement,
	VideoTrack,
	AdjustmentElement,
} from "@/types/timeline";
import type { MediaAsset } from "@/types/assets";
import { RootNode } from "./nodes/root-node";
import { VideoNode } from "./nodes/video-node";
import { ImageNode } from "./nodes/image-node";
import { TextNode } from "./nodes/text-node";
import { StickerNode } from "./nodes/sticker-node";
import { ColorNode } from "./nodes/color-node";
import { BlurBackgroundNode } from "./nodes/blur-background-node";
import { BlurEffectNode } from "./nodes/blur-effect-node";
import { TransitionNode } from "./nodes/transition-node";
import { AdjustmentLayerNode } from "./nodes/adjustment-layer-node";
import type { BaseNode } from "./nodes/base-node";
import type { TBackground, TCanvasSize } from "@/types/project";
import { DEFAULT_BLUR_INTENSITY } from "@/constants/project-constants";
import { isBottomAlignedSubtitleText } from "@/lib/timeline/text-utils";
import { computeFilterString } from "./filter-string";

export type BuildSceneParams = {
	canvasSize: TCanvasSize;
	tracks: TimelineTrack[];
	mediaAssets: MediaAsset[];
	duration: number;
	background: TBackground;
};

function buildVisualElementNode({
	element,
	mediaMap,
}: {
	element: VideoElement | ImageElement;
	mediaMap: Map<string, MediaAsset>;
}): BaseNode | null {
	const mediaAsset = mediaMap.get(element.mediaId);
	if (!mediaAsset?.file || !mediaAsset?.url) {
		return null;
	}

	if (mediaAsset.type === "video") {
		const videoElement = element as VideoElement;
		return new VideoNode({
			mediaId: mediaAsset.id,
			url: mediaAsset.url,
			file: mediaAsset.file,
			duration: element.duration,
			timeOffset: element.startTime,
			trimStart: element.trimStart,
			trimEnd: element.trimEnd,
			transform: element.transform,
			opacity: element.opacity,
			filter: computeFilterString(element.filter, element.adjustments),
			blendMode: element.blendMode,
			crop: element.crop,
				vignette: element.adjustments?.vignette ?? 0,
				chromaKey: element.chromaKey,
				videoEffect: element.videoEffect,
				shapeMask: element.shapeMask,
				backgroundRemoval: element.backgroundRemoval,
				pip: element.pip,
				keyframes: element.keyframes,
			playbackRate: videoElement.playbackRate,
			reversed: videoElement.reversed,
		});
	}

	if (mediaAsset.type === "image") {
		return new ImageNode({
			url: mediaAsset.url,
			duration: element.duration,
			timeOffset: element.startTime,
			trimStart: element.trimStart,
			trimEnd: element.trimEnd,
			transform: element.transform,
			opacity: element.opacity,
			filter: computeFilterString(element.filter, element.adjustments),
			blendMode: element.blendMode,
			crop: element.crop,
			vignette: element.adjustments?.vignette ?? 0,
			chromaKey: element.chromaKey,
			videoEffect: element.videoEffect,
			shapeMask: element.shapeMask,
			backgroundRemoval: element.backgroundRemoval,
				pip: element.pip,
				keyframes: element.keyframes,
		});
	}

	return null;
}
function getElementEndTime({
	element,
}: {
	element: VideoElement | ImageElement;
}): number {
	return element.startTime + element.duration;
}

export function buildScene(params: BuildSceneParams) {
	const { tracks, mediaAssets, duration, canvasSize, background } = params;

	const rootNode = new RootNode({ duration });
	const mediaMap = new Map(mediaAssets.map((m) => [m.id, m]));

	const visibleTracks = tracks.filter(
		(track) => !("hidden" in track && track.hidden),
	);

	// Honour the user's track order from the timeline UI (top track = top of
	// canvas). Previously the scene builder partitioned tracks into non-main vs
	// main and forced main to the bottom regardless of `getTracks()` order,
	// which meant dragging the main track above an overlay track in the UI had
	// no visible effect on the canvas.
	const orderedTracksBottomToTop = visibleTracks.slice().reverse();

	const contentNodes: BaseNode[] = [];

	for (const track of orderedTracksBottomToTop) {
		const elements = track.elements
			.filter((element) => !("hidden" in element && element.hidden))
			.slice()
			.sort((a, b) => {
				if (a.startTime !== b.startTime) return a.startTime - b.startTime;
				return a.id.localeCompare(b.id);
			});

		if (track.type === "video") {
			const videoTrack = track as VideoTrack;
			const visualElements = elements as (VideoElement | ImageElement)[];
			const processedIds = new Set<string>();

			const trackTransitions = videoTrack.transitions ?? [];
			const transitionLookup = new Map<string, typeof trackTransitions[number]>();
			for (const transition of trackTransitions) {
				const key = `${transition.fromElementId}:${transition.toElementId}`;
				transitionLookup.set(key, transition);
			}

			for (let i = 0; i < visualElements.length; i++) {
				const element = visualElements[i];
				if (processedIds.has(element.id)) continue;

				// look ahead: check transition with next element
				if (i < visualElements.length - 1) {
					const nextElement = visualElements[i + 1];
					const pairKey = `${element.id}:${nextElement.id}`;
					const transition = transitionLookup.get(pairKey);

					if (transition) {
						const outgoingNode = buildVisualElementNode({
							element,
							mediaMap,
						});
						const incomingNode = buildVisualElementNode({
							element: nextElement,
							mediaMap,
						});

						if (outgoingNode && incomingNode) {
							processedIds.add(element.id);
							processedIds.add(nextElement.id);

							const junctionTime = nextElement.startTime;
							contentNodes.push(
								new TransitionNode({
									type: transition.type,
									duration: transition.duration,
									transitionStart:
										junctionTime - transition.duration / 2,
									outgoingNode,
									incomingNode,
									outgoingEndTime: getElementEndTime({
										element,
									}),
									incomingStartTime: nextElement.startTime,
								}),
							);
							continue;
						}
					}
				}

				const node = buildVisualElementNode({ element, mediaMap });
				if (node) {
					processedIds.add(element.id);
					contentNodes.push(node);
				}
			}

			continue;
		}

		if (track.type === "adjustment") {
			const spans = (elements as AdjustmentElement[]).map((element) => ({
				adjustments: element.adjustments,
				startTime: element.startTime,
				duration: element.duration,
			}));
			if (spans.length > 0) {
				// Wrap everything collected so far (all tracks below this one);
				// tracks above keep appending after the wrapper, unaffected.
				const wrapper = new AdjustmentLayerNode({
					spans,
					contentNodes: contentNodes.splice(0),
				});
				contentNodes.push(wrapper);
			}
			continue;
		}

		for (const element of elements) {
			if (element.type === "text") {
				const textBaseline = isBottomAlignedSubtitleText({ element })
					? "bottom"
					: "middle";
				contentNodes.push(
					new TextNode({
						...element,
						canvasCenter: {
							x: canvasSize.width / 2,
							y: canvasSize.height / 2,
						},
						canvasWidth: canvasSize.width,
						canvasHeight: canvasSize.height,
						textBaseline,
					}),
				);
			}

			if (element.type === "sticker") {
				contentNodes.push(
					new StickerNode({
						iconName: element.iconName,
						duration: element.duration,
						timeOffset: element.startTime,
						trimStart: element.trimStart,
						trimEnd: element.trimEnd,
						transform: element.transform,
						opacity: element.opacity,
						color: element.color,
						keyframes: element.keyframes,
					}),
				);
			}

			if (element.type === "blur-effect") {
				contentNodes.push(
					new BlurEffectNode({
						blurIntensity: element.blurIntensity,
						boxWidth: element.boxWidth,
						boxHeight: element.boxHeight,
						duration: element.duration,
						timeOffset: element.startTime,
						trimStart: element.trimStart,
						trimEnd: element.trimEnd,
						transform: element.transform,
						opacity: element.opacity,
						keyframes: element.keyframes,
					}),
				);
			}
		}
	}

	if (background.type === "blur") {
		rootNode.add(
			new BlurBackgroundNode({
				blurIntensity: background.blurIntensity ?? DEFAULT_BLUR_INTENSITY,
				contentNodes,
			}),
		);
		for (const node of contentNodes) {
			rootNode.add(node);
		}
	} else if (background.type === "gradient") {
		rootNode.add(new ColorNode({ color: background.css }));
		for (const node of contentNodes) {
			rootNode.add(node);
		}
	} else {
		if (background.type === "color" && background.color !== "transparent") {
			rootNode.add(new ColorNode({ color: background.color }));
		}
		for (const node of contentNodes) {
			rootNode.add(node);
		}
	}

	return rootNode;
}
