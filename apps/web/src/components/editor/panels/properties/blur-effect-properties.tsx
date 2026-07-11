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
import { clamp } from "@/utils/math";
import { useEditor } from "@/hooks/use-editor";
import type { BlurEffectElement } from "@/types/timeline";

export function BlurEffectProperties({
	_element: element,
	trackId,
}: {
	_element: BlurEffectElement;
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
	const isEditingIntensity = useRef(false);

	const scaleDraft = useRef("");
	const posXDraft = useRef("");
	const posYDraft = useRef("");
	const rotationDraft = useRef("");
	const opacityDraft = useRef("");
	const intensityDraft = useRef("");

	const initialScaleRef = useRef<number | null>(null);
	const initialPosXRef = useRef<number | null>(null);
	const initialPosYRef = useRef<number | null>(null);
	const initialRotationRef = useRef<number | null>(null);
	const initialOpacityRef = useRef<number | null>(null);
	const initialIntensityRef = useRef<number | null>(null);

	const scalePercent = Math.round(element.transform.scale * 100);
	const scaleDisplay = isEditingScale.current
		? scaleDraft.current
		: scalePercent.toString();
	const posXDisplay = isEditingPosX.current
		? posXDraft.current
		: Math.round(element.transform.position.x).toString();
	const posYDisplay = isEditingPosY.current
		? posYDraft.current
		: Math.round(element.transform.position.y).toString();
	const rotationDisplay = isEditingRotation.current
		? rotationDraft.current
		: Math.round(element.transform.rotate).toString();
	const opacityDisplay = isEditingOpacity.current
		? opacityDraft.current
		: Math.round(element.opacity * 100).toString();
	const intensityDisplay = isEditingIntensity.current
		? intensityDraft.current
		: Math.round(element.blurIntensity).toString();

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
					title={t("Effect")}
					hasBorderTop={false}
					collapsible={false}
				>
					<div className="space-y-6">
						<PropertyItem direction="column">
							<PropertyItemLabel>{t("Blur Intensity")}</PropertyItemLabel>
							<PropertyItemValue>
								<div className="flex items-center gap-2">
									<Slider
										value={[element.blurIntensity]}
										min={0}
										max={100}
										step={1}
										onValueChange={([value]) => {
											if (initialIntensityRef.current === null) {
												initialIntensityRef.current = element.blurIntensity;
											}
											updateElement({
												updates: { blurIntensity: value },
												pushHistory: false,
											});
										}}
										onValueCommit={([value]) => {
											if (initialIntensityRef.current !== null) {
												updateElement({
													updates: {
														blurIntensity: initialIntensityRef.current,
													},
													pushHistory: false,
												});
												updateElement({
													updates: { blurIntensity: value },
													pushHistory: true,
												});
												initialIntensityRef.current = null;
											}
										}}
										className="w-full"
									/>
									<Input
										type="number"
										value={intensityDisplay}
										min={0}
										max={100}
										onFocus={() => {
											isEditingIntensity.current = true;
											intensityDraft.current = Math.round(
												element.blurIntensity,
											).toString();
											forceRender();
										}}
										onChange={(event) => {
											intensityDraft.current = event.target.value;
											forceRender();
											if (initialIntensityRef.current === null) {
												initialIntensityRef.current = element.blurIntensity;
											}
											const parsed = Number.parseInt(event.target.value, 10);
											if (!Number.isNaN(parsed)) {
												const clamped = clamp({
													value: parsed,
													min: 0,
													max: 100,
												});
												updateElement({
													updates: { blurIntensity: clamped },
													pushHistory: false,
												});
											}
										}}
										onBlur={() => {
											if (initialIntensityRef.current !== null) {
												const parsed = Number.parseInt(
													intensityDraft.current,
													10,
												);
												const clamped = Number.isNaN(parsed)
													? Math.round(element.blurIntensity)
													: clamp({ value: parsed, min: 0, max: 100 });
												updateElement({
													updates: {
														blurIntensity: initialIntensityRef.current,
													},
													pushHistory: false,
												});
												updateElement({
													updates: { blurIntensity: clamped },
													pushHistory: true,
												});
												initialIntensityRef.current = null;
											}
											isEditingIntensity.current = false;
											intensityDraft.current = "";
											forceRender();
										}}
										className="bg-accent h-7 w-14 [appearance:textfield] rounded-sm px-2 text-center !text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
									/>
								</div>
							</PropertyItemValue>
						</PropertyItem>
					</div>
				</PropertyGroup>

				<PropertyGroup title={t("Transform")} collapsible={false}>
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
											element.transform.position.x,
										).toString();
										forceRender();
									}}
									onChange={(event) => {
										posXDraft.current = event.target.value;
										forceRender();
										if (initialPosXRef.current === null) {
											initialPosXRef.current = element.transform.position.x;
										}
										const parsed = Number.parseFloat(event.target.value);
										if (!Number.isNaN(parsed)) {
											updateTransform({
												updates: {
													position: {
														...element.transform.position,
														x: parsed,
													},
												},
												pushHistory: false,
											});
										}
									}}
									onBlur={() => {
										commitNumberField({
											draft: posXDraft.current,
											initial: initialPosXRef,
											apply: (value) => {
												updateTransform({
													updates: {
														position: {
															...element.transform.position,
															x: initialPosXRef.current ?? 0,
														},
													},
													pushHistory: false,
												});
												updateTransform({
													updates: {
														position: {
															...element.transform.position,
															x: value,
														},
													},
													pushHistory: true,
												});
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
											element.transform.position.y,
										).toString();
										forceRender();
									}}
									onChange={(event) => {
										posYDraft.current = event.target.value;
										forceRender();
										if (initialPosYRef.current === null) {
											initialPosYRef.current = element.transform.position.y;
										}
										const parsed = Number.parseFloat(event.target.value);
										if (!Number.isNaN(parsed)) {
											updateTransform({
												updates: {
													position: {
														...element.transform.position,
														y: parsed,
													},
												},
												pushHistory: false,
											});
										}
									}}
									onBlur={() => {
										commitNumberField({
											draft: posYDraft.current,
											initial: initialPosYRef,
											apply: (value) => {
												updateTransform({
													updates: {
														position: {
															...element.transform.position,
															y: initialPosYRef.current ?? 0,
														},
													},
													pushHistory: false,
												});
												updateTransform({
													updates: {
														position: {
															...element.transform.position,
															y: value,
														},
													},
													pushHistory: true,
												});
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
												initialScaleRef.current = element.transform.scale;
											}
											updateTransform({
												updates: { scale: value / 100 },
												pushHistory: false,
											});
										}}
										onValueCommit={([value]) => {
											if (initialScaleRef.current !== null) {
												updateTransform({
													updates: { scale: initialScaleRef.current },
													pushHistory: false,
												});
												updateTransform({
													updates: { scale: value / 100 },
													pushHistory: true,
												});
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
												initialScaleRef.current = element.transform.scale;
											}
											const parsed = Number.parseInt(event.target.value, 10);
											if (!Number.isNaN(parsed)) {
												const clamped = clamp({
													value: parsed,
													min: 10,
													max: 500,
												});
												updateTransform({
													updates: { scale: clamped / 100 },
													pushHistory: false,
												});
											}
										}}
										onBlur={() => {
											if (initialScaleRef.current !== null) {
												const parsed = Number.parseInt(scaleDraft.current, 10);
												const clamped = Number.isNaN(parsed)
													? scalePercent
													: clamp({ value: parsed, min: 10, max: 500 });
												updateTransform({
													updates: { scale: initialScaleRef.current },
													pushHistory: false,
												});
												updateTransform({
													updates: { scale: clamped / 100 },
													pushHistory: true,
												});
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
										value={[element.transform.rotate]}
										min={-180}
										max={180}
										step={1}
										onValueChange={([value]) => {
											if (initialRotationRef.current === null) {
												initialRotationRef.current = element.transform.rotate;
											}
											updateTransform({
												updates: { rotate: value },
												pushHistory: false,
											});
										}}
										onValueCommit={([value]) => {
											if (initialRotationRef.current !== null) {
												updateTransform({
													updates: {
														rotate: initialRotationRef.current,
													},
													pushHistory: false,
												});
												updateTransform({
													updates: { rotate: value },
													pushHistory: true,
												});
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
												element.transform.rotate,
											).toString();
											forceRender();
										}}
										onChange={(event) => {
											rotationDraft.current = event.target.value;
											forceRender();
											if (initialRotationRef.current === null) {
												initialRotationRef.current = element.transform.rotate;
											}
											const parsed = Number.parseFloat(event.target.value);
											if (!Number.isNaN(parsed)) {
												updateTransform({
													updates: { rotate: parsed },
													pushHistory: false,
												});
											}
										}}
										onBlur={() => {
											commitNumberField({
												draft: rotationDraft.current,
												initial: initialRotationRef,
												apply: (value) => {
													updateTransform({
														updates: {
															rotate: initialRotationRef.current ?? 0,
														},
														pushHistory: false,
													});
													updateTransform({
														updates: { rotate: value },
														pushHistory: true,
													});
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
										value={[element.opacity * 100]}
										min={0}
										max={100}
										step={1}
										onValueChange={([value]) => {
											if (initialOpacityRef.current === null) {
												initialOpacityRef.current = element.opacity;
											}
											updateElement({
												updates: { opacity: value / 100 },
												pushHistory: false,
											});
										}}
										onValueCommit={([value]) => {
											if (initialOpacityRef.current !== null) {
												updateElement({
													updates: {
														opacity: initialOpacityRef.current,
													},
													pushHistory: false,
												});
												updateElement({
													updates: { opacity: value / 100 },
													pushHistory: true,
												});
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
												element.opacity * 100,
											).toString();
											forceRender();
										}}
										onChange={(event) => {
											opacityDraft.current = event.target.value;
											forceRender();
											if (initialOpacityRef.current === null) {
												initialOpacityRef.current = element.opacity;
											}
											const parsed = Number.parseInt(event.target.value, 10);
											if (!Number.isNaN(parsed)) {
												const opacityPercent = clamp({
													value: parsed,
													min: 0,
													max: 100,
												});
												updateElement({
													updates: {
														opacity: opacityPercent / 100,
													},
													pushHistory: false,
												});
											}
										}}
										onBlur={() => {
											if (initialOpacityRef.current !== null) {
												const parsed = Number.parseInt(
													opacityDraft.current,
													10,
												);
												const opacityPercent = Number.isNaN(parsed)
													? Math.round(element.opacity * 100)
													: clamp({
															value: parsed,
															min: 0,
															max: 100,
														});
												updateElement({
													updates: {
														opacity: initialOpacityRef.current,
													},
													pushHistory: false,
												});
												updateElement({
													updates: {
														opacity: opacityPercent / 100,
													},
													pushHistory: true,
												});
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
			</PanelBaseView>
		</div>
	);
}
