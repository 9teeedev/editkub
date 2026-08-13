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
import type {
	AdjustmentControls,
	ElementKeyframes,
	ImageElement,
	KeyframeProperty,
	Transform,
	VideoElement,
} from "@/types/timeline";
import { enhanceVoice } from "@/lib/audio/voice-enhance";
import { encodeWav } from "@/lib/audio/wav-encoder";
import { changeVoice, type VoicePreset } from "@/lib/audio/voice-changer";
import { processMediaAssets } from "@/lib/media/processing";
import { decodeAudioToFloat32 } from "@/lib/media/audio";
import { detectSilence, invertSegments } from "@/lib/audio/silence-detection";
import { ADJUSTMENT_DEFAULTS } from "@/constants/adjustment-constants";
import {
	isPatchSignificant,
	matchStats,
	sampleElementStats,
} from "@/lib/color-match";

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
		"enhance-voice",
		() => {
			void (async () => {
				const resolved = editor.timeline.getElementsWithTracks({
					elements: selectedElements,
				});
				const targets = resolved
					.map(({ track, element }) => ({ track, element }))
					.filter(({ element }) => {
						if (element.type === "audio") {
							return element.sourceType === "upload";
						}
						return element.type === "video";
					});

				if (targets.length === 0) {
					toast.info(i18next.t("Select an audio or video clip"));
					return;
				}

				const assets = editor.media.getAssets();
				const activeProject = editor.project.getActive();
				if (!activeProject) return;
				const projectId = activeProject.metadata.id;
				const toastId = "enhance-voice";
				toast.loading(i18next.t("Enhancing audio..."), { id: toastId });

				let processed = 0;
				for (const { track, element } of targets) {
					const mediaId =
						element.type === "audio" && element.sourceType === "upload"
							? element.mediaId
							: element.type === "video"
								? element.mediaId
								: null;
					if (!mediaId) continue;
					const file = assets.find((a) => a.id === mediaId)?.file;
					if (!file) continue;

					const enhanced = await enhanceVoice(file);
					if (!enhanced) {
						toast.error(
							i18next.t("Could not enhance {{name}}", { name: element.name }),
							{ id: toastId },
						);
						continue;
					}

					const wavBlob = encodeWav(enhanced.samples, enhanced.sampleRate);
					const enhancedFile = new File(
						[wavBlob],
						`${element.name} (enhanced).wav`,
						{ type: "audio/wav" },
					);
					const [processedAsset] = await processMediaAssets({
						files: [enhancedFile],
					});
					if (!processedAsset) continue;

					const newMediaId = await editor.media.addMediaAsset({
						projectId,
						asset: processedAsset,
					});

					editor.timeline.updateElements({
						updates: [
							{
								trackId: track.id,
								elementId: element.id,
								updates: { mediaId: newMediaId },
							},
						],
						pushHistory: processed === 0,
					});
					processed++;
				}

				if (processed === 0) {
					toast.info(i18next.t("Audio enhancement failed"), { id: toastId });
				} else {
					toast.success(
						i18next.t("Enhanced {{count}} clip(s)", { count: processed }),
						{ id: toastId },
					);
				}
			})();
		},
		undefined,
	);

	useActionHandler(
		"change-voice",
		(args) => {
			if (!args?.preset) return;
			const { preset } = args;
			void (async () => {
				const resolved = editor.timeline.getElementsWithTracks({
					elements: selectedElements,
				});
				const targets = resolved
					.map(({ track, element }) => ({ track, element }))
					.filter(({ element }) => {
						if (element.type === "audio") {
							return element.sourceType === "upload";
						}
						return element.type === "video";
					});

				if (targets.length === 0) {
					toast.info(i18next.t("Select an audio or video clip"));
					return;
				}

				const assets = editor.media.getAssets();
				const activeProject = editor.project.getActive();
				if (!activeProject) return;
				const projectId = activeProject.metadata.id;
				const toastId = "change-voice";
				toast.loading(i18next.t("Changing voice..."), { id: toastId });

				let processed = 0;
				for (const { track, element } of targets) {
					const mediaId =
						element.type === "audio" && element.sourceType === "upload"
							? element.mediaId
							: element.type === "video"
								? element.mediaId
								: null;
					if (!mediaId) continue;
					const file = assets.find((a) => a.id === mediaId)?.file;
					if (!file) continue;

					const changed = await changeVoice(file, preset as VoicePreset);
					if (!changed) {
						toast.error(
							i18next.t("Could not process {{name}}", { name: element.name }),
							{ id: toastId },
						);
						continue;
					}

					const wavBlob = encodeWav(changed.samples, changed.sampleRate);
					const changedFile = new File(
						[wavBlob],
						`${element.name} (${preset}).wav`,
						{ type: "audio/wav" },
					);
					const [processedAsset] = await processMediaAssets({
						files: [changedFile],
					});
					if (!processedAsset) continue;

					const newMediaId = await editor.media.addMediaAsset({
						projectId,
						asset: processedAsset,
					});

					editor.timeline.updateElements({
						updates: [
							{
								trackId: track.id,
								elementId: element.id,
								updates: { mediaId: newMediaId },
							},
						],
						pushHistory: processed === 0,
					});
					processed++;
				}

				if (processed === 0) {
					toast.info(i18next.t("Voice change failed"), { id: toastId });
				} else {
					toast.success(
						i18next.t("Applied {{preset}} to {{count}} clip(s)", {
							preset,
							count: processed,
						}),
						{ id: toastId },
					);
				}
			})();
		},
		undefined,
	);

	useActionHandler(
		"remove-silence",
		() => {
			void (async () => {
				const resolved = editor.timeline.getElementsWithTracks({
					elements: selectedElements,
				});
				// Audio-bearing elements: upload audio (mediaId) or video.
				const targets = resolved
					.map(({ track, element }) => ({ track, element }))
					.filter(({ element }) => {
						if (element.type === "audio") {
							return element.sourceType === "upload";
						}
						return element.type === "video";
					});

				if (targets.length === 0) {
					toast.info(i18next.t("Select an audio or video clip"));
					return;
				}

				const assets = editor.media.getAssets();
				const toastId = "remove-silence";
				toast.loading(i18next.t("Analyzing audio..."), { id: toastId });

				let totalRemoved = 0;
				let processed = 0;
				const threshold = -40; // dBFS
				const minDuration = 0.3; // seconds

				for (const { track, element } of targets) {
					const mediaId =
						element.type === "audio" && element.sourceType === "upload"
							? element.mediaId
							: element.type === "video"
								? element.mediaId
								: null;
					if (!mediaId) continue;
					const file = assets.find((a) => a.id === mediaId)?.file;
					if (!file) continue;

					let samples: Float32Array;
					let sampleRate: number;
					try {
						const decoded = await decodeAudioToFloat32({
							audioBlob: file,
							targetSampleRate: 16000,
						});
						samples = decoded.samples;
						sampleRate = decoded.sampleRate;
					} catch {
						toast.error(
							i18next.t("Could not decode audio for {{name}}", {
								name: element.name,
							}),
							{ id: toastId },
						);
						continue;
					}

					// trimEnd=0 means full source in timeline elements.
					const playbackRate =
						"playbackRate" in element ? (element.playbackRate ?? 1) : 1;
					const sourceDuration =
						element.trimEnd > element.trimStart
							? element.trimEnd - element.trimStart
							: element.duration * playbackRate;
					const startSample = Math.floor(element.trimStart * sampleRate);
					const endSample = Math.min(
						samples.length,
						Math.floor((element.trimStart + sourceDuration) * sampleRate),
					);
					const slice = samples.subarray(startSample, endSample);

					const silence = detectSilence(slice, sampleRate, {
						threshold,
						minDuration,
						pad: 0.05,
					});
					const kept = invertSegments(silence, sourceDuration);

					if (silence.length === 0 || kept.length === 1) {
						continue;
					}

					editor.timeline.removeSilence({
						target: { trackId: track.id, elementId: element.id },
						keptSegments: kept,
					});

					const removed =
						sourceDuration - kept.reduce((s, k) => s + (k.end - k.start), 0);
					totalRemoved += removed;
					processed++;
				}

				if (processed === 0) {
					toast.info(i18next.t("No silence detected"), { id: toastId });
				} else {
					toast.success(
						i18next.t(
							"Removed {{seconds}}s of silence from {{count}} clip(s)",
							{
								seconds: totalRemoved.toFixed(1),
								count: processed,
							},
						),
						{ id: toastId },
					);
				}
			})();
		},
		undefined,
	);

	useActionHandler(
		"match-color",
		() => {
			// Fire-and-forget: TActionFunc returns void, but sampling is async.
			void (async () => {
				const resolved = editor.timeline.getElementsWithTracks({
					elements: selectedElements,
				});
				// Visual elements only (video/image carry adjustments + mediaId).
				const visuals = resolved.filter(
					({ element }) => element.type === "video" || element.type === "image",
				) as {
					track: { id: string };
					element: VideoElement | ImageElement;
				}[];

				if (visuals.length < 2) {
					toast.info(
						i18next.t(
							"Select a target clip and a reference clip (Shift-click)",
						),
					);
					return;
				}

				// Convention: first selected = reference, rest = targets.
				const [reference, ...targets] = visuals;
				const assets = editor.media.getAssets();
				const refFile = assets.find(
					(a) => a.id === reference.element.mediaId,
				)?.file;
				if (!refFile) {
					toast.error(i18next.t("Reference media not found"));
					return;
				}

				const currentTime = editor.playback.getCurrentTime();
				const toastId = "match-color";
				toast.loading(i18next.t("Matching color..."), { id: toastId });

				const refStats = await sampleElementStats({
					element: reference.element,
					file: refFile,
					currentTime,
				});
				if (!refStats) {
					toast.error(i18next.t("Could not read reference frame"), {
						id: toastId,
					});
					return;
				}

				let applied = 0;
				for (const { track, element } of targets) {
					const file = assets.find((a) => a.id === element.mediaId)?.file;
					if (!file) continue;

					const srcStats = await sampleElementStats({
						element,
						file,
						currentTime,
					});
					if (!srcStats) continue;

					const patch = matchStats({ source: srcStats, reference: refStats });
					if (!isPatchSignificant(patch)) continue;

					// Merge over existing adjustments (defaults if absent).
					const base = element.adjustments ?? ADJUSTMENT_DEFAULTS;
					const merged: AdjustmentControls = {
						brightness: patch.brightness * base.brightness,
						contrast: patch.contrast * base.contrast,
						saturation: patch.saturation * base.saturation,
						temperature: clampAdjust(
							base.temperature + patch.temperature,
							-100,
							100,
						),
						tint: clampAdjust(base.tint + patch.tint, -100, 100),
						hue: base.hue, // untouched
						vignette: base.vignette,
						sharpen: base.sharpen,
					};

					editor.timeline.updateElements({
						updates: [
							{
								trackId: track.id,
								elementId: element.id,
								updates: { adjustments: merged },
							},
						],
						pushHistory: applied === 0, // single history entry
					});
					applied++;
				}

				if (applied === 0) {
					toast.info(i18next.t("No color change needed"), { id: toastId });
				} else {
					toast.success(
						i18next.t("Color matched {{count}} clip(s)", { count: applied }),
						{ id: toastId },
					);
				}
			})();
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

/** Clamp a color-match temperature/tint delta into its valid range. */
function clampAdjust(n: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, n));
}
