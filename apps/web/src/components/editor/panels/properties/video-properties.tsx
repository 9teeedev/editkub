"use client";

import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useReducer, useRef } from "react";
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
import type { ImageElement, VideoElement, AdjustmentControls } from "@/types/timeline";
import { SPEED_PRESETS, formatSpeedLabel } from "@/lib/timeline/speed-utils";
import { FILTER_PRESETS } from "@/constants/filter-constants";
import { BLEND_MODES } from "@/constants/blend-mode-constants";
import { hasContentBelowElement } from "@/lib/timeline/track-utils";
import { Info } from "lucide-react";
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem,
} from "@/components/ui/select";

export function VideoProperties({
	_element: element,
	trackId,
}: {
	_element: VideoElement | ImageElement;
	trackId: string;
}) {
	const { t } = useTranslation();
	const editor = useEditor();
	const [, forceRender] = useReducer((x: number) => x + 1, 0);

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

	const ADJUSTMENT_DEFAULTS: AdjustmentControls = {
		brightness: 1,
		contrast: 1,
		saturation: 1,
		temperature: 0,
		tint: 0,
		hue: 0,
		vignette: 0,
		sharpen: 0,
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
