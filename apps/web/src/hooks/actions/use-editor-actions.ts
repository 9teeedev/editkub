"use client";

import { useTimelineStore } from "@/stores/timeline-store";
import { useMediaPreviewStore } from "@/stores/media-preview-store";
import { useActionHandler } from "@/hooks/actions/use-action-handler";
import { useEditor } from "../use-editor";
import { useElementSelection } from "../timeline/element/use-element-selection";
import { getElementsAtTime } from "@/lib/timeline";
import { generateAndInsertSpeech } from "@/lib/tts/service";
import { toast } from "sonner";
import { i18next } from "@/lib/i18n";
import {
	KEYFRAME_PROPERTIES,
	enableChannel,
	generateKeyframeId,
	getKeyframeAtTime,
	hasChannel,
	sampleChannel,
	setChannel,
	upsertKeyframe,
} from "@/lib/timeline/keyframe-utils";
import type { ElementKeyframes, KeyframeProperty } from "@/types/timeline";

export function useEditorActions() {
	const editor = useEditor();
	const activeProject = editor.project.getActive();
	const { selectedElements, setElementSelection } = useElementSelection();
	const { clipboard, setClipboard, toggleSnapping } = useTimelineStore();

	useActionHandler(
		"toggle-play",
		() => {
			useMediaPreviewStore.getState().clearSelection();
			editor.playback.toggle();
		},
		undefined,
	);

	useActionHandler(
		"stop-playback",
		() => {
			if (editor.playback.getIsPlaying()) {
				editor.playback.toggle();
			}
			editor.playback.seek({ time: 0 });
		},
		undefined,
	);

	useActionHandler(
		"seek-forward",
		(args) => {
			const seconds = args?.seconds ?? 1;
			editor.playback.seek({
				time: Math.min(
					editor.timeline.getTotalDuration(),
					editor.playback.getCurrentTime() + seconds,
				),
			});
		},
		undefined,
	);

	useActionHandler(
		"seek-backward",
		(args) => {
			const seconds = args?.seconds ?? 1;
			editor.playback.seek({
				time: Math.max(0, editor.playback.getCurrentTime() - seconds),
			});
		},
		undefined,
	);

	useActionHandler(
		"frame-step-forward",
		() => {
			const fps = activeProject.settings.fps;
			editor.playback.seek({
				time: Math.min(
					editor.timeline.getTotalDuration(),
					editor.playback.getCurrentTime() + 1 / fps,
				),
			});
		},
		undefined,
	);

	useActionHandler(
		"frame-step-backward",
		() => {
			const fps = activeProject.settings.fps;
			editor.playback.seek({
				time: Math.max(0, editor.playback.getCurrentTime() - 1 / fps),
			});
		},
		undefined,
	);

	useActionHandler(
		"jump-forward",
		(args) => {
			const seconds = args?.seconds ?? 5;
			editor.playback.seek({
				time: Math.min(
					editor.timeline.getTotalDuration(),
					editor.playback.getCurrentTime() + seconds,
				),
			});
		},
		undefined,
	);

	useActionHandler(
		"jump-backward",
		(args) => {
			const seconds = args?.seconds ?? 5;
			editor.playback.seek({
				time: Math.max(0, editor.playback.getCurrentTime() - seconds),
			});
		},
		undefined,
	);

	useActionHandler(
		"goto-start",
		() => {
			editor.playback.seek({ time: 0 });
		},
		undefined,
	);

	useActionHandler(
		"goto-end",
		() => {
			editor.playback.seek({ time: editor.timeline.getTotalDuration() });
		},
		undefined,
	);

	useActionHandler(
		"split",
		() => {
			const currentTime = editor.playback.getCurrentTime();
			const elementsToSplit =
				selectedElements.length > 0
					? selectedElements
					: getElementsAtTime({
							tracks: editor.timeline.getTracks(),
							time: currentTime,
						});

			if (elementsToSplit.length === 0) return;

			editor.timeline.splitElements({
				elements: elementsToSplit,
				splitTime: currentTime,
			});
		},
		undefined,
	);

	useActionHandler(
		"split-left",
		() => {
			const currentTime = editor.playback.getCurrentTime();
			const elementsToSplit =
				selectedElements.length > 0
					? selectedElements
					: getElementsAtTime({
							tracks: editor.timeline.getTracks(),
							time: currentTime,
						});

			if (elementsToSplit.length === 0) return;

			editor.timeline.splitElements({
				elements: elementsToSplit,
				splitTime: currentTime,
				retainSide: "right",
			});
		},
		undefined,
	);

	useActionHandler(
		"split-right",
		() => {
			const currentTime = editor.playback.getCurrentTime();
			const elementsToSplit =
				selectedElements.length > 0
					? selectedElements
					: getElementsAtTime({
							tracks: editor.timeline.getTracks(),
							time: currentTime,
						});

			if (elementsToSplit.length === 0) return;

			editor.timeline.splitElements({
				elements: elementsToSplit,
				splitTime: currentTime,
				retainSide: "left",
			});
		},
		undefined,
	);

	useActionHandler(
		"delete-selected",
		() => {
			if (selectedElements.length === 0) {
				return;
			}
			editor.timeline.deleteElements({
				elements: selectedElements,
			});
			editor.selection.clearSelection();
		},
		undefined,
	);

	useActionHandler(
		"select-all",
		() => {
			const allElements = editor.timeline.getTracks().flatMap((track) =>
				track.elements.map((element) => ({
					trackId: track.id,
					elementId: element.id,
				})),
			);
			setElementSelection({ elements: allElements });
		},
		undefined,
	);

	useActionHandler(
		"duplicate-selected",
		() => {
			editor.timeline.duplicateElements({
				elements: selectedElements,
			});
		},
		undefined,
	);

	useActionHandler(
		"toggle-elements-muted-selected",
		() => {
			editor.timeline.toggleElementsMuted({ elements: selectedElements });
		},
		undefined,
	);

	useActionHandler(
		"toggle-elements-visibility-selected",
		() => {
			editor.timeline.toggleElementsVisibility({ elements: selectedElements });
		},
		undefined,
	);

	useActionHandler(
		"detach-audio",
		() => {
			if (selectedElements.length === 0) return;
			editor.timeline.detachAudio({ elements: selectedElements });
		},
		undefined,
	);

	useActionHandler(
		"toggle-bookmark",
		() => {
			editor.scenes.toggleBookmark({ time: editor.playback.getCurrentTime() });
		},
		undefined,
	);

	useActionHandler(
		"add-keyframe-at-playhead",
		() => {
			if (selectedElements.length === 0) {
				toast.error(i18next.t("Select an element first"));
				return;
			}
			if (selectedElements.length > 1) {
				toast.error(i18next.t("Select a single element"));
				return;
			}

			const results = editor.timeline.getElementsWithTracks({
				elements: selectedElements,
			});
			const entry = results[0];
			if (!entry) return;
			const { track, element } = entry;

			// Only visual elements support keyframes.
			if (!("keyframes" in element) && !("transform" in element)) {
				toast.error(i18next.t("This element does not support keyframes"));
				return;
			}

			const localTime = Math.max(
				0,
				Math.min(
					element.duration,
					editor.playback.getCurrentTime() - element.startTime,
				),
			);

			// Read base values for channels we may need to seed.
			const baseTransform =
				"transform" in element ? element.transform : undefined;
			const baseOpacity = "opacity" in element ? element.opacity : 1;
			if (!baseTransform) {
				toast.error(i18next.t("This element does not support keyframes"));
				return;
			}

			const getBaseValue = (property: KeyframeProperty): number => {
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

			const current =
				(element as { keyframes?: ElementKeyframes }).keyframes ?? {};
			let next: ElementKeyframes = { ...current };

			// Seed all channels on first keyframe press so a baseline animation
			// curve exists. Subsequent presses only drop a keyframe at the
			// playhead (sampling each channel's current interpolated value).
			const wasEmpty = KEYFRAME_PROPERTIES.every(
				(p) => !hasChannel(current, p),
			);
			if (wasEmpty) {
				for (const property of KEYFRAME_PROPERTIES) {
					next = enableChannel(
						next,
						property,
						getBaseValue(property),
						element.duration,
					);
				}
			}

			// For channels already active, drop a keyframe at the playhead if
			// there isn't already one there.
			for (const property of KEYFRAME_PROPERTIES) {
				if (!hasChannel(next, property)) continue;
				const existing = next[property] ?? [];
				const atTime = getKeyframeAtTime(existing, localTime);
				if (atTime) continue;
				const value =
					existing.length > 0
						? sampleChannel(existing, localTime).value
						: getBaseValue(property);
				next = setChannel(
					next,
					property,
					upsertKeyframe(existing, {
						id: generateKeyframeId(),
						time: localTime,
						value,
						easing: "linear",
					}),
				);
			}

			editor.timeline.updateKeyframes({
				trackId: track.id,
				elementId: element.id,
				keyframes: next,
			});

			toast.success(
				wasEmpty
					? i18next.t("Keyframes enabled at playhead")
					: i18next.t("Keyframe added at playhead"),
			);
		},
		undefined,
	);

	useActionHandler(
		"copy-selected",
		() => {
			if (selectedElements.length === 0) return;

			const results = editor.timeline.getElementsWithTracks({
				elements: selectedElements,
			});
			const items = results.map(({ track, element }) => {
				const { ...elementWithoutId } = element;
				return {
					trackId: track.id,
					trackType: track.type,
					element: elementWithoutId,
				};
			});

			setClipboard({ items });
		},
		undefined,
	);

	useActionHandler(
		"paste-copied",
		() => {
			if (!clipboard?.items.length) return;

			editor.timeline.pasteAtTime({
				time: editor.playback.getCurrentTime(),
				clipboardItems: clipboard.items,
			});
		},
		undefined,
	);

	useActionHandler(
		"toggle-snapping",
		() => {
			toggleSnapping();
		},
		undefined,
	);

	useActionHandler(
		"convert-to-speech",
		() => {
			const results = editor.timeline.getElementsWithTracks({
				elements: selectedElements,
			});
			const textElements = results.filter(
				({ element }) => element.type === "text",
			);

			if (textElements.length === 0) return;

			const toastId = "convert-to-speech";
			toast.loading(
				i18next.t("Converting {{count}} text to speech...", {
					count: textElements.length,
				}),
				{ id: toastId },
			);

			(async () => {
				let successCount = 0;
				let failCount = 0;

				for (const { element } of textElements) {
					if (element.type !== "text") continue;
					try {
						await generateAndInsertSpeech({
							editor,
							text: element.content,
							startTime: element.startTime,
						});
						successCount++;
					} catch (error) {
						console.error("TTS conversion failed for element:", error);
						failCount++;
					}
				}

				if (failCount === 0) {
					toast.success(
						i18next.t("Converted {{count}} text to speech", {
							count: successCount,
						}),
						{ id: toastId },
					);
				} else {
					toast.warning(
						i18next.t("{{success}} converted, {{fail}} failed", {
							success: successCount,
							fail: failCount,
						}),
						{ id: toastId },
					);
				}
			})();
		},
		undefined,
	);

	useActionHandler(
		"undo",
		() => {
			editor.command.undo();
		},
		undefined,
	);

	useActionHandler(
		"redo",
		() => {
			editor.command.redo();
		},
		undefined,
	);
}
