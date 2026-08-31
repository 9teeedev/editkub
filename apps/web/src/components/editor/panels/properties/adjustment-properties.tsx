"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { Slider } from "@/components/ui/slider";
import { PanelBaseView } from "@/components/editor/panels/panel-base-view";
import {
	PropertyGroup,
	PropertyItem,
	PropertyItemLabel,
	PropertyItemValue,
} from "./property-item";
import { useEditor } from "@/hooks/use-editor";
import { ADJUSTMENT_DEFAULTS } from "@/constants/adjustment-constants";
import type { AdjustmentControls, AdjustmentElement } from "@/types/timeline";

const ADJUSTMENT_SLIDERS = [
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
] as const;

export function AdjustmentProperties({
	_element: element,
	trackId,
}: {
	_element: AdjustmentElement;
	trackId: string;
}) {
	const { t } = useTranslation();
	const editor = useEditor();

	const updateAdjustment = (
		key: keyof AdjustmentControls,
		value: number,
		pushHistory: boolean,
	) => {
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					updates: {
						adjustments: {
							...ADJUSTMENT_DEFAULTS,
							...element.adjustments,
							[key]: value,
						},
					},
				},
			],
			pushHistory,
		});
	};

	return (
		<div className="flex h-full flex-col">
			<PanelBaseView className="p-0">
				<PropertyGroup
					title={t("Adjustments")}
					hasBorderTop={false}
					collapsible={false}
				>
					<p className="text-muted-foreground px-1 text-xs">
						{t("Applies to every clip below this layer.")}
					</p>
					<div className="space-y-6">
						{ADJUSTMENT_SLIDERS.map(({ key, label, min, max, step }) => {
							const value = element.adjustments[key] ?? ADJUSTMENT_DEFAULTS[key];
							return (
								<PropertyItem key={key} direction="column">
									<PropertyItemLabel>{t(label)}</PropertyItemLabel>
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
														aria-label={t("Reset {{name}}", { name: t(label) })}
														onClick={() =>
														updateAdjustment(key, ADJUSTMENT_DEFAULTS[key], true)
												}
												title={t("Reset {{name}}", { name: t(label) })}
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
			</PanelBaseView>
		</div>
	);
}
