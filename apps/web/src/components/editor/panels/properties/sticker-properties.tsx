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
import { ColorPicker } from "@/components/ui/color-picker";
import { clamp } from "@/utils/math";
import { useEditor } from "@/hooks/use-editor";
import type { StickerElement } from "@/types/timeline";

export function StickerProperties({
	_element: element,
	trackId,
}: {
	_element: StickerElement;
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

	const scaleDraft = useRef("");
	const posXDraft = useRef("");
	const posYDraft = useRef("");
	const rotationDraft = useRef("");
	const opacityDraft = useRef("");

	const initialScaleRef = useRef<number | null>(null);
	const initialPosXRef = useRef<number | null>(null);
	const initialPosYRef = useRef<number | null>(null);
	const initialRotationRef = useRef<number | null>(null);
	const initialOpacityRef = useRef<number | null>(null);
	const initialColorRef = useRef<string | null>(null);

	// Keyframe-aware display values: when animated, sample at playhead; else base.
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

	// Auto-keyframe writers: animated channels upsert at playhead; else fallback.
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

	const updateElement = ({
		updates,
		pushHistory = true,
	}: {
		updates: Partial<Record<string, unknown>>;
		pushHistory?: boolean;
	}) => {
		editor.timeline.updateElements({
			updates: [{ trackId, elementId: element.id, updates }],
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
		updateElement({
			updates: { transform: { ...element.transform, ...updates } },
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

	return (
		<div className="flex h-full flex-col">
			<PanelBaseView className="p-0">
				<PropertyGroup
					title={t("Transform")}
					hasBorderTop={false}
					collapsible={false}
				>
						<div className="space-y-6">
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
									onChange={(event) => {
										posXDraft.current = event.target.value;
										forceRender();
										if (initialPosXRef.current === null) {
											initialPosXRef.current = posX.resolvedValue;
										}
										const parsed = Number.parseFloat(event.target.value);
										if (!Number.isNaN(parsed)) {
											posXWriter.commitValue(parsed, false, () =>
												updateTransform({
													updates: {
														position: {
															...element.transform.position,
															x: parsed,
														},
													},
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
														updates: {
															position: {
																...element.transform.position,
																x: initialPosXRef.current ?? 0,
															},
														},
														pushHistory: false,
													}),
												);
												posXWriter.commitValue(value, true, () =>
													updateTransform({
														updates: {
															position: {
																...element.transform.position,
																x: value,
															},
														},
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
									onChange={(event) => {
										posYDraft.current = event.target.value;
										forceRender();
										if (initialPosYRef.current === null) {
											initialPosYRef.current = posY.resolvedValue;
										}
										const parsed = Number.parseFloat(event.target.value);
										if (!Number.isNaN(parsed)) {
											posYWriter.commitValue(parsed, false, () =>
												updateTransform({
													updates: {
														position: {
															...element.transform.position,
															y: parsed,
														},
													},
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
														updates: {
															position: {
																...element.transform.position,
																y: initialPosYRef.current ?? 0,
															},
														},
														pushHistory: false,
													}),
												);
												posYWriter.commitValue(value, true, () =>
													updateTransform({
														updates: {
															position: {
																...element.transform.position,
																y: value,
															},
														},
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
										onChange={(event) => {
											scaleDraft.current = event.target.value;
											forceRender();
											if (initialScaleRef.current === null) {
												initialScaleRef.current = scaleProp.resolvedValue;
											}
											const parsed = Number.parseInt(event.target.value, 10);
											if (!Number.isNaN(parsed)) {
												const clamped = clamp({
													value: parsed,
													min: 10,
													max: 500,
												});
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
												const parsed = Number.parseInt(
													scaleDraft.current,
													10,
												);
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
										onChange={(event) => {
											rotationDraft.current = event.target.value;
											forceRender();
											if (initialRotationRef.current === null) {
												initialRotationRef.current = rotateProp.resolvedValue;
											}
											const parsed = Number.parseFloat(event.target.value);
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
															updates: {
																rotate: initialRotationRef.current ?? 0,
															},
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
												updateElement({
													updates: { opacity: value / 100 },
													pushHistory: false,
												}),
											);
										}}
										onValueCommit={([value]) => {
											if (initialOpacityRef.current !== null) {
												const initial = initialOpacityRef.current;
												opacityWriter.commitValue(initial, false, () =>
													updateElement({
														updates: { opacity: initial },
														pushHistory: false,
													}),
												);
												opacityWriter.commitValue(value / 100, true, () =>
													updateElement({
														updates: { opacity: value / 100 },
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
										onChange={(event) => {
											opacityDraft.current = event.target.value;
											forceRender();
											if (initialOpacityRef.current === null) {
												initialOpacityRef.current = opacityProp.resolvedValue;
											}
											const parsed = Number.parseInt(
												event.target.value,
												10,
											);
											if (!Number.isNaN(parsed)) {
												const opacityPercent = clamp({
													value: parsed,
													min: 0,
													max: 100,
												});
												opacityWriter.commitValue(opacityPercent / 100, false, () =>
													updateElement({
														updates: { opacity: opacityPercent / 100 },
														pushHistory: false,
													}),
												);
											}
										}}
										onBlur={() => {
											if (initialOpacityRef.current !== null) {
												const initial = initialOpacityRef.current;
												const parsed = Number.parseInt(
													opacityDraft.current,
													10,
												);
												const opacityPercent = Number.isNaN(parsed)
													? Math.round(opacityProp.resolvedValue * 100)
													: clamp({
															value: parsed,
															min: 0,
															max: 100,
														});
												opacityWriter.commitValue(initial, false, () =>
													updateElement({
														updates: { opacity: initial },
														pushHistory: false,
													}),
												);
												opacityWriter.commitValue(opacityPercent / 100, true, () =>
													updateElement({
														updates: { opacity: opacityPercent / 100 },
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

						<PropertyItem>
							<PropertyItemLabel>{t("Color")}</PropertyItemLabel>
							<PropertyItemValue>
								<ColorPicker
									value={element.color ?? "#000000"}
									onChange={(value) => {
										if (initialColorRef.current === null) {
											initialColorRef.current = element.color ?? "#000000";
										}
										updateElement({
											updates: { color: value },
											pushHistory: false,
										});
									}}
									onChangeEnd={(value) => {
										if (initialColorRef.current !== null) {
											updateElement({
												updates: { color: initialColorRef.current },
												pushHistory: false,
											});
											updateElement({
												updates: { color: value },
												pushHistory: true,
											});
											initialColorRef.current = null;
										}
									}}
								/>
							</PropertyItemValue>
						</PropertyItem>
					</div>
				</PropertyGroup>
			</PanelBaseView>
		</div>
	);
}
