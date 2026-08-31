"use client";

import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useReducer, useRef, useSyncExternalStore } from "react";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { PanelBaseView } from "@/components/editor/panels/panel-base-view";
import {
	PropertyGroup,
	PropertyItem,
	PropertyItemLabel,
	PropertyItemValue,
} from "./property-item";
import { KeyframeRow } from "./keyframe-row";
import { useAnimatedProperty } from "./use-animated-property";
import { useAnimatedValueWriter } from "./use-animated-value-writer";
import { clamp } from "@/utils/math";
import { useEditor } from "@/hooks/use-editor";
import type {
	ChromaKeyConfig,
	CropConfig,
	ImageElement,
	MaskShape,
	ShapeMaskConfig,
	VideoElement,
	AdjustmentControls,
	PictureInPictureConfig,
	PictureInPicturePreset,
} from "@/types/timeline";
import { SPEED_PRESETS, formatSpeedLabel } from "@/lib/timeline/speed-utils";
import { FILTER_PRESETS } from "@/constants/filter-constants";
import { ADJUSTMENT_DEFAULTS } from "@/constants/adjustment-constants";
import { invokeAction } from "@/lib/actions";
import { ColorPicker } from "@/components/ui/color-picker";
import { Button } from "@/components/ui/button";
import {
	CHROMA_DEFAULT,
	CHROMA_PRESETS,
	hexToRgb,
	rgbToHex,
} from "@/lib/renderer/chroma-key";
import { MASK_DEFAULT, MASK_PRESETS } from "@/lib/renderer/shape-mask";
import {
	CROP_DEFAULT,
	CROP_PRESETS,
	MIN_CROP,
	cropRectForAspect,
	type CropPreset,
} from "@/lib/renderer/crop";
import { useCropStore } from "@/stores/crop-store";
import { BLEND_MODES } from "@/constants/blend-mode-constants";
import { hasContentBelowElement } from "@/lib/timeline/track-utils";
import { Info, Loader2, Pipette } from "lucide-react";
import { useChromaPickerStore } from "@/stores/chroma-picker-store";
import { Progress } from "@/components/ui/progress";
import {
	cancelBackgroundRemoval,
	getBackgroundRemovalStatus,
	requestBackgroundRemoval,
	subscribeBackgroundRemovalStatus,
} from "@/lib/renderer/background-removal";
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const PIP_PRESET_OPTIONS: Array<{
	value: PictureInPicturePreset;
	label: string;
}> = [
	{ value: "corner-top-left", label: "Top left" },
	{ value: "corner-top-right", label: "Top right" },
	{ value: "corner-bottom-left", label: "Bottom left" },
	{ value: "corner-bottom-right", label: "Bottom right" },
	{ value: "split-left", label: "Split left" },
	{ value: "split-right", label: "Split right" },
];

export function VideoProperties({
	_element: element,
	trackId,
}: {
	_element: VideoElement | ImageElement;
	trackId: string;
}) {
	const { t } = useTranslation();
	const editor = useEditor();
	const isPickingChroma = useChromaPickerStore((state) => state.isPicking);
	const setChromaPicking = useChromaPickerStore((state) => state.setPicking);
	const [, forceRender] = useReducer((x: number) => x + 1, 0);
	const backgroundRemovalStatus = useSyncExternalStore(
		subscribeBackgroundRemovalStatus,
		getBackgroundRemovalStatus,
		getBackgroundRemovalStatus,
	);

	const isEditingScale = useRef(false);
	const isEditingPosX = useRef(false);
	const isEditingPosY = useRef(false);
	const isEditingRotation = useRef(false);
	const isEditingOpacity = useRef(false);
	const isEditingSpeed = useRef(false);

	const scaleDraft = useRef("");
	const posXDraft = useRef("");
	const posYDraft = useRef("");
	const rotationDraft = useRef("");
	const opacityDraft = useRef("");
	const speedDraft = useRef("");

	const initialScaleRef = useRef<number | null>(null);
	const initialPosXRef = useRef<number | null>(null);
	const initialPosYRef = useRef<number | null>(null);
	const initialRotationRef = useRef<number | null>(null);
	const initialOpacityRef = useRef<number | null>(null);
	const initialSpeedRef = useRef<number | null>(null);

	// Keyframe-aware display values: when a channel is animated, the input
	// shows the value sampled at the playhead (instead of the static base).
	// While the user is typing (isEditing=true), we keep showing the draft
	// so the cursor doesn't jump on each keystroke.
	const posX = useAnimatedProperty({
		keyframes: element.keyframes,
		property: "position.x",
		baseValue: element.transform.position.x,
		elementStartTime: element.startTime,
		elementDuration: element.duration,
	});
	const posY = useAnimatedProperty({
		keyframes: element.keyframes,
		property: "position.y",
		baseValue: element.transform.position.y,
		elementStartTime: element.startTime,
		elementDuration: element.duration,
	});
	const scaleProp = useAnimatedProperty({
		keyframes: element.keyframes,
		property: "scale",
		baseValue: element.transform.scale,
		elementStartTime: element.startTime,
		elementDuration: element.duration,
	});
	const rotateProp = useAnimatedProperty({
		keyframes: element.keyframes,
		property: "rotate",
		baseValue: element.transform.rotate,
		elementStartTime: element.startTime,
		elementDuration: element.duration,
	});
	const opacityProp = useAnimatedProperty({
		keyframes: element.keyframes,
		property: "opacity",
		baseValue: element.opacity,
		elementStartTime: element.startTime,
		elementDuration: element.duration,
	});

	// Auto-keyframe writers: when a channel is animated, edits upsert a
	// keyframe at the playhead instead of mutating the static base.
	const posXWriter = useAnimatedValueWriter({
		keyframes: element.keyframes,
		property: "position.x",
		trackId,
		elementId: element.id,
		elementStartTime: element.startTime,
		elementDuration: element.duration,
	});
	const posYWriter = useAnimatedValueWriter({
		keyframes: element.keyframes,
		property: "position.y",
		trackId,
		elementId: element.id,
		elementStartTime: element.startTime,
		elementDuration: element.duration,
	});
	const scaleWriter = useAnimatedValueWriter({
		keyframes: element.keyframes,
		property: "scale",
		trackId,
		elementId: element.id,
		elementStartTime: element.startTime,
		elementDuration: element.duration,
	});
	const rotateWriter = useAnimatedValueWriter({
		keyframes: element.keyframes,
		property: "rotate",
		trackId,
		elementId: element.id,
		elementStartTime: element.startTime,
		elementDuration: element.duration,
	});
	const opacityWriter = useAnimatedValueWriter({
		keyframes: element.keyframes,
		property: "opacity",
		trackId,
		elementId: element.id,
		elementStartTime: element.startTime,
		elementDuration: element.duration,
	});

	const scalePercent = Math.round(scaleProp.resolvedValue * 100);
	const scaleDisplay = isEditingScale.current
		? scaleDraft.current
		: scalePercent.toString();
	const posXDisplay = isEditingPosX.current
		? posXDraft.current
		: Math.round(posX.resolvedValue).toString();
	const posYDisplay = isEditingPosY.current
		? posYDraft.current
		: Math.round(posY.resolvedValue).toString();
	const rotationDisplay = isEditingRotation.current
		? rotationDraft.current
		: Math.round(rotateProp.resolvedValue).toString();
	const opacityDisplay = isEditingOpacity.current
		? opacityDraft.current
		: Math.round(opacityProp.resolvedValue * 100).toString();

	const isVideoElement = element.type === "video";
	const currentSpeed = isVideoElement
		? (element as VideoElement).playbackRate ?? 1
		: 1;
	const speedDisplay = isEditingSpeed.current
		? speedDraft.current
		: formatSpeedLabel({ rate: currentSpeed });

	const applySpeedChange = ({
		newRate,
		pushHistory,
	}: {
		newRate: number;
		pushHistory: boolean;
	}) => {
		if (!isVideoElement) return;
		const oldRate = currentSpeed;
		const newDuration = element.duration * (oldRate / newRate);

		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: {
						playbackRate: newRate,
						duration: newDuration,
					},
				},
			],
			pushHistory,
		});
	};

	const updateTransform = ({
		updates,
		pushHistory = true,
	}: {
		updates: Partial<typeof element.transform>;
		pushHistory?: boolean;
	}) => {
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: {
						transform: { ...element.transform, ...updates },
					},
				},
			],
			pushHistory,
		});
	};

	const commitNumberField = ({
		draft,
		initial,
		apply,
	}: {
		draft: string;
		initial: React.RefObject<number | null>;
		apply: (value: number) => void;
	}) => {
		if (initial.current === null) return;
		const parsed = Number.parseFloat(draft);
		if (!Number.isNaN(parsed)) {
			apply(parsed);
		}
		initial.current = null;
	};

	const getAdjustment = (key: keyof AdjustmentControls): number => {
		return element.adjustments?.[key] ?? ADJUSTMENT_DEFAULTS[key];
	};

	const updateAdjustment = (
		key: keyof AdjustmentControls,
		value: number,
		pushHistory: boolean,
	) => {
		const current = element.adjustments ?? { ...ADJUSTMENT_DEFAULTS };
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: {
						adjustments: { ...current, [key]: value },
					},
				},
			],
			pushHistory,
		});
	};

	const chroma: ChromaKeyConfig | undefined = element.chromaKey;

	const updateChroma = (
		patch: Partial<ChromaKeyConfig>,
		pushHistory: boolean,
	) => {
		const current = chroma ?? { ...CHROMA_DEFAULT };
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: { chromaKey: { ...current, ...patch } },
				},
			],
			pushHistory,
		});
	};

	const toggleChroma = (enabled: boolean) => {
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: {
						chromaKey: enabled ? { ...CHROMA_DEFAULT } : undefined,
					},
				},
			],
			pushHistory: true,
		});
	};

	const mask: ShapeMaskConfig | undefined = element.shapeMask;
	const backgroundRemoval = element.backgroundRemoval;
	const backgroundRemovalBusy =
		backgroundRemovalStatus === "loading" ||
		backgroundRemovalStatus === "processing";
	const backgroundRemovalStatusLabel =
		backgroundRemovalStatus === "loading"
			? t("Loading background removal model…")
			: backgroundRemovalStatus === "processing"
				? t("Removing background…")
				: backgroundRemovalStatus === "ready"
					? t("Background removal ready")
					: backgroundRemovalStatus === "error"
						? t("Background removal failed. Toggle off and on to retry.")
						: null;

	const updateMask = (
		patch: Partial<ShapeMaskConfig>,
		pushHistory: boolean,
	) => {
		const current = mask ?? { ...MASK_DEFAULT };
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: { shapeMask: { ...current, ...patch } },
				},
			],
			pushHistory,
		});
	};

	const toggleMask = (enabled: boolean) => {
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: {
						shapeMask: enabled ? { ...MASK_DEFAULT } : undefined,
					},
				},
			],
			pushHistory: true,
		});
	};

	const crop = element.crop;
	const cropElementId = useCropStore((state) => state.elementId);
	const setCropping = useCropStore((state) => state.setCropping);
	const isCropping = cropElementId === element.id;

	const updateCrop = (patch: Partial<CropConfig>, pushHistory: boolean) => {
		const current = crop ?? { ...CROP_DEFAULT };
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: { crop: { ...current, ...patch } },
				},
			],
			pushHistory,
		});
	};

	const toggleCrop = (enabled: boolean) => {
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: { crop: enabled ? { ...CROP_DEFAULT } : undefined },
				},
			],
			pushHistory: true,
		});
		if (!enabled) setCropping(null);
	};

	const applyCropPreset = (preset: CropPreset) => {
		if (preset.ratio === null) {
			updateCrop({ ...CROP_DEFAULT }, true);
			return;
		}
		const asset = editor.media
			.getAssets()
			.find((a) => a.id === element.mediaId);
		const canvasSize = editor.project.getActive()?.settings.canvasSize;
		updateCrop(
			cropRectForAspect({
				sourceWidth: asset?.width || canvasSize?.width || 1920,
				sourceHeight: asset?.height || canvasSize?.height || 1080,
				ratio: preset.ratio,
			}),
			true,
		);
	};

	const updatePip = (
		updates: Partial<PictureInPictureConfig>,
		pushHistory = true,
	) => {
		if (!element.pip) return;
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: { pip: { ...element.pip, ...updates } },
				},
			],
			pushHistory,
		});
	};

	return (
		<div className="flex h-full flex-col">
			<PanelBaseView className="p-0">
				<PropertyGroup title={t("Transform")} hasBorderTop={false} collapsible={false}>
					<div className="space-y-6">
						{/* Position X */}
						<PropertyItem>
							<PropertyItemLabel className="flex items-center gap-1.5">
								{t("Position X")}
								<KeyframeRow
									property="position.x"
									trackId={trackId}
									elementId={element.id}
									keyframes={element.keyframes}
									baseTransform={element.transform}
									baseOpacity={element.opacity}
									elementStartTime={element.startTime}
									elementDuration={element.duration}
								/>
							</PropertyItemLabel>
							<PropertyItemValue>
								<Input
									type="number"
									value={posXDisplay}
									onFocus={() => {
										isEditingPosX.current = true;
										posXDraft.current = Math.round(
											posX.resolvedValue,
										).toString();
										forceRender();
									}}
									onChange={(e) => {
										posXDraft.current = e.target.value;
										forceRender();
										if (initialPosXRef.current === null) {
											initialPosXRef.current = posX.resolvedValue;
										}
										const parsed = Number.parseFloat(e.target.value);
										if (!Number.isNaN(parsed)) {
											posXWriter.commitValue(parsed, false, () =>
												updateTransform({
													updates: { position: { ...element.transform.position, x: parsed } },
													pushHistory: false,
												}),
											);
										}
									}}
									onBlur={() => {
										commitNumberField({
											draft: posXDraft.current,
											initial: initialPosXRef,
											apply: (value) => {
												posXWriter.commitValue(initialPosXRef.current ?? 0, false, () =>
													updateTransform({
														updates: { position: { ...element.transform.position, x: initialPosXRef.current ?? 0 } },
														pushHistory: false,
													}),
												);
												posXWriter.commitValue(value, true, () =>
													updateTransform({
														updates: { position: { ...element.transform.position, x: value } },
														pushHistory: true,
													}),
												);
											},
										});
										isEditingPosX.current = false;
										posXDraft.current = "";
										forceRender();
									}}
									className="bg-accent h-7 w-full [appearance:textfield] rounded-sm px-2 text-center !text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
								/>
							</PropertyItemValue>
						</PropertyItem>

						{/* Position Y */}
						<PropertyItem>
							<PropertyItemLabel className="flex items-center gap-1.5">
								{t("Position Y")}
								<KeyframeRow
									property="position.y"
									trackId={trackId}
									elementId={element.id}
									keyframes={element.keyframes}
									baseTransform={element.transform}
									baseOpacity={element.opacity}
									elementStartTime={element.startTime}
									elementDuration={element.duration}
								/>
							</PropertyItemLabel>
							<PropertyItemValue>
								<Input
									type="number"
									value={posYDisplay}
									onFocus={() => {
										isEditingPosY.current = true;
										posYDraft.current = Math.round(
											posY.resolvedValue,
										).toString();
										forceRender();
									}}
									onChange={(e) => {
										posYDraft.current = e.target.value;
										forceRender();
										if (initialPosYRef.current === null) {
											initialPosYRef.current = posY.resolvedValue;
										}
										const parsed = Number.parseFloat(e.target.value);
										if (!Number.isNaN(parsed)) {
											posYWriter.commitValue(parsed, false, () =>
												updateTransform({
													updates: { position: { ...element.transform.position, y: parsed } },
													pushHistory: false,
												}),
											);
										}
									}}
									onBlur={() => {
										commitNumberField({
											draft: posYDraft.current,
											initial: initialPosYRef,
											apply: (value) => {
												posYWriter.commitValue(initialPosYRef.current ?? 0, false, () =>
													updateTransform({
														updates: { position: { ...element.transform.position, y: initialPosYRef.current ?? 0 } },
														pushHistory: false,
													}),
												);
												posYWriter.commitValue(value, true, () =>
													updateTransform({
														updates: { position: { ...element.transform.position, y: value } },
														pushHistory: true,
													}),
												);
											},
										});
										isEditingPosY.current = false;
										posYDraft.current = "";
										forceRender();
									}}
									className="bg-accent h-7 w-full [appearance:textfield] rounded-sm px-2 text-center !text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
								/>
							</PropertyItemValue>
						</PropertyItem>

						{/* Scale */}
						<PropertyItem direction="column">
							<PropertyItemLabel className="flex items-center gap-1.5">
								{t("Scale")}
								<KeyframeRow
									property="scale"
									trackId={trackId}
									elementId={element.id}
									keyframes={element.keyframes}
									baseTransform={element.transform}
									baseOpacity={element.opacity}
									elementStartTime={element.startTime}
									elementDuration={element.duration}
								/>
							</PropertyItemLabel>
							<PropertyItemValue>
								<div className="flex items-center gap-2">
									<Slider
										value={[scalePercent]}
										min={10}
										max={500}
										step={1}
										onValueChange={([value]) => {
											if (initialScaleRef.current === null) {
												initialScaleRef.current = scaleProp.resolvedValue;
											}
											scaleWriter.commitValue(value / 100, false, () =>
												updateTransform({
													updates: { scale: value / 100 },
													pushHistory: false,
												}),
											);
										}}
										onValueCommit={([value]) => {
											if (initialScaleRef.current !== null) {
												const initial = initialScaleRef.current;
												scaleWriter.commitValue(initial, false, () =>
													updateTransform({
														updates: { scale: initial },
														pushHistory: false,
													}),
												);
												scaleWriter.commitValue(value / 100, true, () =>
													updateTransform({
														updates: { scale: value / 100 },
														pushHistory: true,
													}),
												);
												initialScaleRef.current = null;
											}
										}}
										className="w-full"
									/>
									<Input
										type="number"
										value={scaleDisplay}
										min={10}
										max={500}
										onFocus={() => {
											isEditingScale.current = true;
											scaleDraft.current = scalePercent.toString();
											forceRender();
										}}
										onChange={(e) => {
											scaleDraft.current = e.target.value;
											forceRender();
											if (initialScaleRef.current === null) {
												initialScaleRef.current = scaleProp.resolvedValue;
											}
											const parsed = parseInt(e.target.value, 10);
											if (!Number.isNaN(parsed)) {
												const clamped = clamp({ value: parsed, min: 10, max: 500 });
												scaleWriter.commitValue(clamped / 100, false, () =>
													updateTransform({
														updates: { scale: clamped / 100 },
														pushHistory: false,
													}),
												);
											}
										}}
										onBlur={() => {
											if (initialScaleRef.current !== null) {
												const initial = initialScaleRef.current;
												const parsed = parseInt(scaleDraft.current, 10);
												const clamped = Number.isNaN(parsed)
													? scalePercent
													: clamp({ value: parsed, min: 10, max: 500 });
												scaleWriter.commitValue(initial, false, () =>
													updateTransform({
														updates: { scale: initial },
														pushHistory: false,
													}),
												);
												scaleWriter.commitValue(clamped / 100, true, () =>
													updateTransform({
														updates: { scale: clamped / 100 },
														pushHistory: true,
													}),
												);
												initialScaleRef.current = null;
											}
											isEditingScale.current = false;
											scaleDraft.current = "";
											forceRender();
										}}
										className="bg-accent h-7 w-14 [appearance:textfield] rounded-sm px-2 text-center !text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
									/>
								</div>
							</PropertyItemValue>
						</PropertyItem>

						{/* Rotation */}
						<PropertyItem direction="column">
							<PropertyItemLabel className="flex items-center gap-1.5">
								{t("Rotation")}
								<KeyframeRow
									property="rotate"
									trackId={trackId}
									elementId={element.id}
									keyframes={element.keyframes}
									baseTransform={element.transform}
									baseOpacity={element.opacity}
									elementStartTime={element.startTime}
									elementDuration={element.duration}
								/>
							</PropertyItemLabel>
							<PropertyItemValue>
								<div className="flex items-center gap-2">
									<Slider
										value={[rotateProp.resolvedValue]}
										min={-180}
										max={180}
										step={1}
										onValueChange={([value]) => {
											if (initialRotationRef.current === null) {
												initialRotationRef.current = rotateProp.resolvedValue;
											}
											rotateWriter.commitValue(value, false, () =>
												updateTransform({
													updates: { rotate: value },
													pushHistory: false,
												}),
											);
										}}
										onValueCommit={([value]) => {
											if (initialRotationRef.current !== null) {
												const initial = initialRotationRef.current;
												rotateWriter.commitValue(initial, false, () =>
													updateTransform({
														updates: { rotate: initial },
														pushHistory: false,
													}),
												);
												rotateWriter.commitValue(value, true, () =>
													updateTransform({
														updates: { rotate: value },
														pushHistory: true,
													}),
												);
												initialRotationRef.current = null;
											}
										}}
										className="w-full"
									/>
									<Input
										type="number"
										value={rotationDisplay}
										min={-360}
										max={360}
										onFocus={() => {
											isEditingRotation.current = true;
											rotationDraft.current = Math.round(
												rotateProp.resolvedValue,
											).toString();
											forceRender();
										}}
										onChange={(e) => {
											rotationDraft.current = e.target.value;
											forceRender();
											if (initialRotationRef.current === null) {
												initialRotationRef.current = rotateProp.resolvedValue;
											}
											const parsed = Number.parseFloat(e.target.value);
											if (!Number.isNaN(parsed)) {
												rotateWriter.commitValue(parsed, false, () =>
													updateTransform({
														updates: { rotate: parsed },
														pushHistory: false,
													}),
												);
											}
										}}
										onBlur={() => {
											commitNumberField({
												draft: rotationDraft.current,
												initial: initialRotationRef,
												apply: (value) => {
													rotateWriter.commitValue(initialRotationRef.current ?? 0, false, () =>
														updateTransform({
															updates: { rotate: initialRotationRef.current ?? 0 },
															pushHistory: false,
														}),
													);
													rotateWriter.commitValue(value, true, () =>
														updateTransform({
															updates: { rotate: value },
															pushHistory: true,
														}),
													);
												},
											});
											isEditingRotation.current = false;
											rotationDraft.current = "";
											forceRender();
										}}
										className="bg-accent h-7 w-14 [appearance:textfield] rounded-sm px-2 text-center !text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
									/>
								</div>
							</PropertyItemValue>
						</PropertyItem>
					</div>
				</PropertyGroup>

				<PropertyGroup
					title={t("Crop")}
					defaultExpanded={element.crop !== undefined}
				>
					<div className="space-y-4">
						<PropertyItem>
							<PropertyItemLabel>{t("Enable crop")}</PropertyItemLabel>
							<PropertyItemValue>
								<Switch checked={crop !== undefined} onCheckedChange={toggleCrop} />
							</PropertyItemValue>
						</PropertyItem>
						{crop && (
							<>
								<PropertyItem direction="column">
									<PropertyItemLabel>{t("Aspect ratio")}</PropertyItemLabel>
									<PropertyItemValue>
										<div className="grid grid-cols-3 gap-1.5">
											{CROP_PRESETS.map((preset) => (
												<Button
													key={preset.id}
													variant="outline"
													size="sm"
													className="h-7 px-2 text-[11px]"
													onClick={() => applyCropPreset(preset)}
												>
													{t(preset.label)}
												</Button>
											))}
										</div>
									</PropertyItemValue>
								</PropertyItem>
								<PropertyItem>
									<PropertyItemLabel>{t("Adjust on canvas")}</PropertyItemLabel>
									<PropertyItemValue>
										<Button
											variant={isCropping ? "default" : "outline"}
											size="sm"
											className="hidden h-7 px-2 text-[11px] md:inline-flex"
											onClick={() => setCropping(isCropping ? null : element.id)}
										>
											{isCropping ? t("Done") : t("Adjust")}
										</Button>
									</PropertyItemValue>
								</PropertyItem>
								{(
									[
										["X", "x", 0, Math.max(0, 1 - crop.width)],
										["Y", "y", 0, Math.max(0, 1 - crop.height)],
										["Width", "width", MIN_CROP, Math.max(MIN_CROP, 1 - crop.x)],
										[
											"Height",
											"height",
											MIN_CROP,
											Math.max(MIN_CROP, 1 - crop.y),
										],
									] as const
								).map(([label, key, min, max]) => (
									<PropertyItem key={key} direction="column">
										<PropertyItemLabel>{t(label)}</PropertyItemLabel>
										<PropertyItemValue>
											<div className="flex items-center gap-2">
												<Slider
													value={[crop[key]]}
													min={min}
													max={max}
													step={0.01}
													onValueChange={([value]) =>
														updateCrop({ [key]: value }, false)
													}
													onValueCommit={([value]) =>
														updateCrop({ [key]: value }, true)
													}
													className="flex-1"
												/>
												<span className="text-muted-foreground w-10 text-right text-xs">
													{crop[key].toFixed(2)}
												</span>
											</div>
										</PropertyItemValue>
									</PropertyItem>
								))}
								<p className="text-muted-foreground text-xs">
									{t(
										"Cut away outer regions of the clip. Drag on the canvas for precise control.",
									)}
								</p>
							</>
						)}
					</div>
				</PropertyGroup>

				<PropertyGroup
					title={t("Picture-in-Picture")}
					defaultExpanded={element.pip !== undefined}
				>
					<div className="space-y-4">
						<PropertyItem direction="column">
							<PropertyItemLabel>{t("Preset")}</PropertyItemLabel>
							<PropertyItemValue>
								<div className="grid grid-cols-2 gap-1.5">
									{PIP_PRESET_OPTIONS.map(({ value, label }) => (
										<Button
											key={value}
											variant={element.pip?.preset === value ? "default" : "outline"}
											size="sm"
											className="h-7 px-2 text-[11px]"
											onClick={() => invokeAction("apply-pip-preset", { preset: value })}
										>
											{t(label)}
										</Button>
									))}
								</div>
							</PropertyItemValue>
						</PropertyItem>

						{element.pip && (
							<>
								<PropertyItem direction="column">
									<PropertyItemLabel>{t("Corner radius")}</PropertyItemLabel>
									<PropertyItemValue>
										<Slider
											value={[element.pip.borderRadius]}
											min={0}
											max={96}
											step={1}
											onValueChange={([value]) => updatePip({ borderRadius: value }, false)}
											onValueCommit={([value]) => updatePip({ borderRadius: value }, true)}
										/>
									</PropertyItemValue>
								</PropertyItem>

								<PropertyItem>
									<PropertyItemLabel>{t("Border")}</PropertyItemLabel>
									<PropertyItemValue>
										<div className="flex items-center gap-2">
											<Slider
												value={[element.pip.borderWidth]}
												min={0}
												max={16}
												step={1}
												onValueChange={([value]) => updatePip({ borderWidth: value }, false)}
												onValueCommit={([value]) => updatePip({ borderWidth: value }, true)}
												className="flex-1"
											/>
											<ColorPicker
												value={element.pip.borderColor.replace("#", "")}
												onChange={(color) => updatePip({ borderColor: `#${color}` }, false)}
												onChangeEnd={(color) => updatePip({ borderColor: `#${color}` }, true)}
											/>
										</div>
									</PropertyItemValue>
								</PropertyItem>

								<PropertyItem>
									<PropertyItemLabel>{t("Shadow")}</PropertyItemLabel>
									<PropertyItemValue>
										<Switch
											checked={element.pip.shadow}
											onCheckedChange={(shadow) => updatePip({ shadow }, true)}
										/>
									</PropertyItemValue>
								</PropertyItem>
							</>
						)}
					</div>
				</PropertyGroup>

				<PropertyGroup title={t("Appearance")} collapsible={false}>
					<div className="space-y-6">
						{/* Opacity */}
						<PropertyItem direction="column">
							<PropertyItemLabel className="flex items-center gap-1.5">
								{t("Opacity")}
								<KeyframeRow
									property="opacity"
									trackId={trackId}
									elementId={element.id}
									keyframes={element.keyframes}
									baseTransform={element.transform}
									baseOpacity={element.opacity}
									elementStartTime={element.startTime}
									elementDuration={element.duration}
								/>
							</PropertyItemLabel>
							<PropertyItemValue>
								<div className="flex items-center gap-2">
									<Slider
										value={[opacityProp.resolvedValue * 100]}
										min={0}
										max={100}
										step={1}
										onValueChange={([value]) => {
											if (initialOpacityRef.current === null) {
												initialOpacityRef.current = opacityProp.resolvedValue;
											}
											opacityWriter.commitValue(value / 100, false, () =>
												editor.timeline.updateElements({
													updates: [
														{
															trackId,
															elementId: element.id,
															updates: { opacity: value / 100 },
														},
													],
													pushHistory: false,
												}),
											);
										}}
										onValueCommit={([value]) => {
											if (initialOpacityRef.current !== null) {
												opacityWriter.commitValue(initialOpacityRef.current, false, () =>
													editor.timeline.updateElements({
														updates: [
															{
																trackId,
																elementId: element.id,
																updates: { opacity: initialOpacityRef.current },
															},
														],
														pushHistory: false,
													}),
												);
												opacityWriter.commitValue(value / 100, true, () =>
													editor.timeline.updateElements({
														updates: [
															{
																trackId,
																elementId: element.id,
																updates: { opacity: value / 100 },
															},
														],
														pushHistory: true,
													}),
												);
												initialOpacityRef.current = null;
											}
										}}
										className="w-full"
									/>
									<Input
										type="number"
										value={opacityDisplay}
										min={0}
										max={100}
										onFocus={() => {
											isEditingOpacity.current = true;
											opacityDraft.current = Math.round(
												opacityProp.resolvedValue * 100,
											).toString();
											forceRender();
										}}
										onChange={(e) => {
											opacityDraft.current = e.target.value;
											forceRender();
											if (initialOpacityRef.current === null) {
												initialOpacityRef.current = opacityProp.resolvedValue;
											}
											const parsed = parseInt(e.target.value, 10);
											if (!Number.isNaN(parsed)) {
												const opacityPercent = clamp({ value: parsed, min: 0, max: 100 });
												opacityWriter.commitValue(opacityPercent / 100, false, () =>
													editor.timeline.updateElements({
														updates: [
															{
																trackId,
																elementId: element.id,
																updates: { opacity: opacityPercent / 100 },
															},
														],
														pushHistory: false,
													}),
												);
											}
										}}
										onBlur={() => {
											if (initialOpacityRef.current !== null) {
												const parsed = parseInt(opacityDraft.current, 10);
												const opacityPercent = Number.isNaN(parsed)
													? Math.round(opacityProp.resolvedValue * 100)
													: clamp({ value: parsed, min: 0, max: 100 });
												opacityWriter.commitValue(initialOpacityRef.current, false, () =>
													editor.timeline.updateElements({
														updates: [
															{
																trackId,
																elementId: element.id,
																updates: { opacity: initialOpacityRef.current },
															},
														],
														pushHistory: false,
													}),
												);
												opacityWriter.commitValue(opacityPercent / 100, true, () =>
													editor.timeline.updateElements({
														updates: [
															{
																trackId,
																elementId: element.id,
																updates: { opacity: opacityPercent / 100 },
															},
														],
														pushHistory: true,
													}),
												);
												initialOpacityRef.current = null;
											}
											isEditingOpacity.current = false;
											opacityDraft.current = "";
											forceRender();
										}}
										className="bg-accent h-7 w-14 [appearance:textfield] rounded-sm px-2 text-center !text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
									/>
								</div>
							</PropertyItemValue>
						</PropertyItem>
					</div>
				</PropertyGroup>

				<PropertyGroup title={t("Filter")} collapsible={false}>
					<div className="space-y-6">
						<PropertyItem direction="column">
							<PropertyItemLabel>{t("Preset")}</PropertyItemLabel>
							<PropertyItemValue>
								<Select
									value={element.filter?.presetId ?? "none"}
									onValueChange={(presetId) => {
										editor.timeline.updateElements({
											updates: [
												{
													trackId,
													elementId: element.id,
													updates: {
														filter:
															presetId === "none"
																? undefined
																: {
																		presetId,
																		intensity:
																			element.filter?.intensity ?? 1,
																	},
													},
												},
											],
											pushHistory: true,
										});
									}}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder={t("None")} />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">{t("None")}</SelectItem>
										{FILTER_PRESETS.filter((p) => p.id !== "none").map(
											(preset) => (
												<SelectItem key={preset.id} value={preset.id}>
													{preset.name}
												</SelectItem>
											),
										)}
									</SelectContent>
								</Select>
							</PropertyItemValue>
						</PropertyItem>

						{element.filter && element.filter.presetId !== "none" && (
							<PropertyItem direction="column">
								<PropertyItemLabel>{t("Intensity")}</PropertyItemLabel>
								<PropertyItemValue>
									<Slider
										value={[element.filter.intensity * 100]}
										min={0}
										max={100}
										step={1}
										onValueChange={([value]) => {
											editor.timeline.updateElements({
												updates: [
													{
														trackId,
														elementId: element.id,
														updates: {
															filter: {
																presetId:
																	element.filter!.presetId,
																intensity: value / 100,
															},
														},
													},
												],
												pushHistory: false,
											});
										}}
										onValueCommit={([value]) => {
											editor.timeline.updateElements({
												updates: [
													{
														trackId,
														elementId: element.id,
														updates: {
															filter: {
																presetId:
																	element.filter!.presetId,
																intensity: value / 100,
															},
														},
													},
												],
												pushHistory: true,
											});
										}}
										className="w-full"
									/>
								</PropertyItemValue>
							</PropertyItem>
						)}
					</div>
				</PropertyGroup>

				<PropertyGroup title={t("Adjustments")} collapsible={false}>
					<div className="space-y-6">
						<button
							type="button"
							onClick={() => invokeAction("match-color")}
							title={t(
								"Match this clip's color to the first selected reference clip",
							)}
							className="hover:bg-accent text-muted-foreground flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed py-1.5 text-xs transition-colors hover:text-foreground"
						>
							{t("Match Color")}
						</button>
						{([
							{
								key: "brightness" as const,
								label: "Brightness",
								min: 0,
								max: 2,
								step: 0.01,
							},
							{
								key: "contrast" as const,
								label: "Contrast",
								min: 0,
								max: 2,
								step: 0.01,
							},
							{
								key: "saturation" as const,
								label: "Saturation",
								min: 0,
								max: 2,
								step: 0.01,
							},
							{
								key: "temperature" as const,
								label: "Temperature",
								min: -100,
								max: 100,
								step: 1,
							},
							{
								key: "tint" as const,
								label: "Tint",
								min: -100,
								max: 100,
								step: 1,
							},
							{
								key: "hue" as const,
								label: "Hue",
								min: -180,
								max: 180,
								step: 1,
							},
							{
								key: "vignette" as const,
								label: "Vignette",
								min: 0,
								max: 100,
								step: 1,
							},
							{
								key: "sharpen" as const,
								label: "Sharpen",
								min: 0,
								max: 100,
								step: 1,
							},
						] as const).map(({ key, label, min, max, step }) => {
							const value = getAdjustment(key);
							return (
								<PropertyItem key={key} direction="column">
									<PropertyItemLabel>
										{t(label)}
									</PropertyItemLabel>
									<PropertyItemValue>
										<div className="flex items-center gap-2">
											<Slider
												value={[value]}
												min={min}
												max={max}
												step={step}
												onValueChange={([v]) =>
													updateAdjustment(key, v, false)
												}
												onValueCommit={([v]) =>
													updateAdjustment(key, v, true)
												}
												className="flex-1"
											/>
											<span className="text-muted-foreground w-10 text-right text-xs">
												{key === "brightness" ||
												key === "contrast" ||
												key === "saturation"
													? value.toFixed(2)
													: value.toFixed(0)}
											</span>
											<button
												type="button"
												className="text-muted-foreground hover:text-foreground text-xs"
												onClick={() =>
													updateAdjustment(
														key,
														ADJUSTMENT_DEFAULTS[key],
														true,
													)
												}
												title={`Reset ${label}`}
											>
												↺
											</button>
										</div>
									</PropertyItemValue>
								</PropertyItem>
							);
						})}
					</div>
				</PropertyGroup>

				<PropertyGroup title={t("Blend Mode")} collapsible={false}>
					<div className="space-y-6">
						<PropertyItem direction="column">
							<PropertyItemLabel>{t("Mode")}</PropertyItemLabel>
							<PropertyItemValue>
								<Select
									value={element.blendMode ?? "source-over"}
									onValueChange={(blendMode) => {
										editor.timeline.updateElements({
											updates: [
												{
													trackId,
													elementId: element.id,
													updates: {
														blendMode:
															blendMode === "source-over"
																? undefined
																: blendMode,
													},
												},
											],
											pushHistory: true,
										});
									}}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder={t("Normal")} />
									</SelectTrigger>
									<SelectContent>
										{BLEND_MODES.map((mode) => (
											<SelectItem key={mode.id} value={mode.value}>
												{mode.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</PropertyItemValue>
							{element.blendMode &&
								element.blendMode !== "source-over" &&
								!hasContentBelowElement({
									tracks: editor.timeline.getTracks(),
									trackId,
									elementId: element.id,
								}) && (
									<div className="bg-muted/40 text-muted-foreground mt-2 flex items-start gap-2 rounded-md p-2 text-xs leading-relaxed">
										<Info className="mt-0.5 size-3.5 shrink-0" />
										<span>
											{t(
												"Blend modes composite against underlying content. Add another clip or image on a track below to see the effect.",
											)}
										</span>
									</div>
								)}
						</PropertyItem>
					</div>
				</PropertyGroup>

				<PropertyGroup title={t("Chroma Key")} collapsible={false}>
					<div className="space-y-4">
						<PropertyItem>
							<PropertyItemLabel>{t("Enable chroma key")}</PropertyItemLabel>
							<PropertyItemValue>
								<div className="flex items-center gap-2">
									<Switch
										checked={chroma !== undefined}
										onCheckedChange={toggleChroma}
									/>
									<Button
										variant="outline"
										size="sm"
										className="h-7 gap-1 px-2 text-xs"
										onClick={() => setChromaPicking(true)}
									>
										<Pipette className="size-3.5" />
										{isPickingChroma
											? t("Click the preview")
											: t("Pick from preview")}
									</Button>
								</div>
							</PropertyItemValue>
						</PropertyItem>
						{chroma && (
							<>
								<PropertyItem direction="column">
									<PropertyItemLabel>{t("Key color")}</PropertyItemLabel>
									<PropertyItemValue>
										<div className="flex items-center gap-2">
											<ColorPicker
												value={rgbToHex(chroma.keyColor)}
												onChange={(hex) =>
													updateChroma({ keyColor: hexToRgb(hex) }, false)
												}
												onChangeEnd={(hex) =>
													updateChroma({ keyColor: hexToRgb(hex) }, true)
												}
											/>
											<div className="flex flex-wrap gap-1">
												{CHROMA_PRESETS.map((preset) => (
													<button
														key={preset.id}
														type="button"
														onClick={() =>
															updateChroma(
																{ keyColor: hexToRgb(preset.hex) },
																true,
															)
														}
														className="size-5 rounded-sm border"
														style={{ backgroundColor: `#${preset.hex}` }}
														title={t(preset.label)}
													/>
												))}
											</div>
										</div>
									</PropertyItemValue>
								</PropertyItem>
								{(
									[
										["Threshold", "threshold", 0, 0.6],
										["Smoothness", "smoothness", 0, 1],
										["Spill suppression", "spillSuppression", 0, 1],
									] as const
								).map(([label, key, min, max]) => (
									<PropertyItem key={key} direction="column">
										<PropertyItemLabel>{t(label)}</PropertyItemLabel>
										<PropertyItemValue>
											<div className="flex items-center gap-2">
												<Slider
													value={[chroma[key]]}
													min={min}
													max={max}
													step={0.01}
													onValueChange={([value]) =>
														updateChroma({ [key]: value }, false)
													}
													onValueCommit={([value]) =>
														updateChroma({ [key]: value }, true)
													}
													className="flex-1"
												/>
												<span className="text-muted-foreground w-10 text-right text-xs">
													{chroma[key].toFixed(2)}
												</span>
											</div>
										</PropertyItemValue>
									</PropertyItem>
								))}
								<p className="text-muted-foreground text-xs">
									{t(
										"Keys out a color (green/blue screen). Per-frame, works with any clip.",
									)}
								</p>
							</>
						)}
					</div>
				</PropertyGroup>

				<PropertyGroup title={t("Background Removal")} collapsible={false}>
					<div className="space-y-3">
						<PropertyItem>
							<PropertyItemLabel>{t("Remove background")}</PropertyItemLabel>
							<PropertyItemValue>
								<Switch
									checked={backgroundRemoval?.enabled ?? false}
									onCheckedChange={(enabled) => {
										if (enabled) requestBackgroundRemoval();
										else cancelBackgroundRemoval();
										editor.timeline.updateElements({
											updates: [
												{
													trackId,
													elementId: element.id,
													updates: {
														backgroundRemoval: enabled
															? { enabled: true }
															: undefined,
													},
												},
											],
											pushHistory: true,
										});
									}}
								/>
							</PropertyItemValue>
						</PropertyItem>
						{backgroundRemoval?.enabled && backgroundRemovalStatusLabel && (
							<div
								className="bg-muted/40 space-y-2 rounded-md border p-2"
								role="status"
								aria-live="polite"
							>
								<div className="flex items-center gap-2 text-xs">
									{backgroundRemovalBusy ? (
										<Loader2
											className="text-primary size-3 shrink-0 animate-spin"
											aria-hidden="true"
										/>
									) : (
										<span aria-hidden="true">
											{backgroundRemovalStatus === "error" ? "!" : "✓"}
										</span>
									)}
									<span>{backgroundRemovalStatusLabel}</span>
								</div>
								{backgroundRemovalBusy && (
									<Progress
										value={50}
										aria-label={backgroundRemovalStatusLabel}
										className="h-1.5 animate-pulse"
									/>
								)}
							</div>
						)}
						<p className="text-muted-foreground text-xs">
							{t("Runs locally with MODNet. The first frame downloads the model.")}
						</p>
					</div>
				</PropertyGroup>

				<PropertyGroup title={t("Mask")} collapsible={false}>
					<div className="space-y-4">
						<PropertyItem>
							<PropertyItemLabel>{t("Enable mask")}</PropertyItemLabel>
							<PropertyItemValue>
								<Switch checked={mask !== undefined} onCheckedChange={toggleMask} />
							</PropertyItemValue>
						</PropertyItem>
						{mask && (
							<>
								<PropertyItem direction="column">
									<PropertyItemLabel>{t("Shape")}</PropertyItemLabel>
									<PropertyItemValue>
										<Select
											value={mask.shape}
											onValueChange={(shape) =>
												updateMask({ shape: shape as MaskShape }, true)
											}
										>
											<SelectTrigger className="w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{MASK_PRESETS.map((preset) => (
													<SelectItem key={preset.id} value={preset.id}>
														{maskPresetLabel(preset.id, t)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</PropertyItemValue>
								</PropertyItem>
								{(
									[
										["Size", "size", 0.05, 1.5],
										["Feather", "feather", 0, 50],
										["Rotation", "rotation", -180, 180],
									] as const
								).map(([label, key, min, max]) => (
									<PropertyItem key={key} direction="column">
										<PropertyItemLabel>{t(label)}</PropertyItemLabel>
										<PropertyItemValue>
											<div className="flex items-center gap-2">
												<Slider
													value={[mask[key]]}
													min={min}
													max={max}
													step={1}
													onValueChange={([value]) =>
														updateMask({ [key]: value }, false)
													}
													onValueCommit={([value]) =>
														updateMask({ [key]: value }, true)
													}
													className="flex-1"
												/>
												<span className="text-muted-foreground w-10 text-right text-xs">
													{mask[key].toFixed(key === "size" ? 2 : 0)}
												</span>
											</div>
										</PropertyItemValue>
									</PropertyItem>
								))}
								<PropertyItem>
									<PropertyItemLabel>{t("Invert")}</PropertyItemLabel>
									<PropertyItemValue>
										<Switch
											checked={mask.invert}
											onCheckedChange={(value) => updateMask({ invert: value }, true)}
										/>
									</PropertyItemValue>
								</PropertyItem>
								<p className="text-muted-foreground text-xs">
									{t(
										"Clip to a shape (circle/rect/star/vignette) with feathered edges.",
									)}
								</p>
							</>
						)}
					</div>
				</PropertyGroup>

				{isVideoElement && (
<PropertyGroup title={t("Speed")} collapsible={false}>
								<div className="space-y-6">
									<PropertyItem direction="column">
										<PropertyItemLabel>{t("Playback Speed")}</PropertyItemLabel>
								<PropertyItemValue>
									<div className="flex flex-wrap gap-1.5">
										{SPEED_PRESETS.map((preset) => {
											const isActive = Math.abs(currentSpeed - preset.value) < 0.001;
											return (
												<button
													key={preset.value}
													type="button"
													className={`rounded-sm px-2 py-0.5 text-xs transition-colors ${
														isActive
															? "bg-primary text-primary-foreground"
															: "bg-accent hover:bg-accent/80"
													}`}
													onClick={() => {
														initialSpeedRef.current = currentSpeed;
														applySpeedChange({
															newRate: preset.value,
															pushHistory: true,
														});
														initialSpeedRef.current = null;
													}}
													onKeyDown={(event) => {
														if (event.key === "Enter" || event.key === " ") {
															initialSpeedRef.current = currentSpeed;
															applySpeedChange({
																newRate: preset.value,
																pushHistory: true,
															});
															initialSpeedRef.current = null;
														}
													}}
												>
													{preset.label}
												</button>
											);
										})}
									</div>
								</PropertyItemValue>
							</PropertyItem>

							<PropertyItem>
								<PropertyItemLabel>{t("Custom")}</PropertyItemLabel>
								<PropertyItemValue>
									<div className="flex items-center gap-1">
										<Input
											type="number"
											value={speedDisplay}
											min={0.25}
											max={4}
											step={0.05}
											onFocus={() => {
												isEditingSpeed.current = true;
												speedDraft.current = formatSpeedLabel({ rate: currentSpeed });
												forceRender();
											}}
											onChange={(event) => {
												speedDraft.current = event.target.value;
												forceRender();
												if (initialSpeedRef.current === null) {
													initialSpeedRef.current = currentSpeed;
												}
												const parsed = Number.parseFloat(event.target.value);
												if (!Number.isNaN(parsed)) {
													const clamped = clamp({ value: parsed, min: 0.25, max: 4 });
													applySpeedChange({
														newRate: clamped,
														pushHistory: false,
													});
												}
											}}
											onBlur={() => {
												if (initialSpeedRef.current !== null) {
													const parsed = Number.parseFloat(speedDraft.current);
													const clamped = Number.isNaN(parsed)
														? currentSpeed
														: clamp({ value: parsed, min: 0.25, max: 4 });
													applySpeedChange({
														newRate: initialSpeedRef.current,
														pushHistory: false,
													});
													applySpeedChange({
														newRate: clamped,
														pushHistory: true,
													});
													initialSpeedRef.current = null;
												}
												isEditingSpeed.current = false;
												speedDraft.current = "";
												forceRender();
											}}
											className="bg-accent h-7 w-full [appearance:textfield] rounded-sm px-2 text-center !text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
										/>
										<span className="text-muted-foreground text-xs">x</span>
									</div>
								</PropertyItemValue>
							</PropertyItem>
						</div>
					</PropertyGroup>
				)}
				</PanelBaseView>
		</div>
	);
}

function maskPresetLabel(id: MaskShape, t: (key: string) => string): string {
	switch (id) {
		case "circle":
			return t("Circle");
		case "rect":
			return t("Rectangle");
		case "star":
			return t("Star");
		case "inverted-circle":
			return t("Vignette");
	}
}
