"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { Slider } from "@/components/ui/slider";
import {
	PropertyItem,
	PropertyItemLabel,
	PropertyItemValue,
} from "./property-item";
import type { TextAnimation } from "@/types/timeline";

interface TextAnimationRowProps {
	/** Current animation value on the element (undefined = none). */
	animation: TextAnimation | undefined;
	/** Commit a new animation value (or undefined to clear). */
	onChange: (animation: TextAnimation | undefined) => void;
}

/**
 * Duration/intensity fine-tune controls for the selected text animation preset.
 * The preset type itself is chosen from the grid in {@link TextAnimationTab};
 * this row only exposes the sliders that apply to the active type.
 */
export function TextAnimationRow({ animation, onChange }: TextAnimationRowProps) {
	const { t } = useTranslation();

	const currentDuration = animation?.duration ?? 0;
	const currentIntensity = animation?.intensity ?? 1;

	const handleDurationChange = (duration: number) => {
		if (!animation) return;
		onChange({ ...animation, duration });
	};

	const handleIntensityChange = (intensity: number) => {
		if (!animation) return;
		onChange({ ...animation, intensity });
	};

	const hasDurationControl =
		animation !== undefined && animation.type !== "karaoke";
	const hasIntensityControl =
		animation !== undefined &&
		(animation.type === "glitch" ||
			animation.type === "bounce" ||
			animation.type === "slide-in" ||
			animation.type === "slide-out");

	return (
		<>
			{hasDurationControl && (
				<PropertyItem direction="column">
					<PropertyItemLabel>
						{t("Duration")}
						<span className="text-muted-foreground ml-1 text-xs">
							{currentDuration === 0
								? t("Loop")
								: `${currentDuration.toFixed(1)}s`}
						</span>
					</PropertyItemLabel>
					<PropertyItemValue>
						<Slider
							value={[currentDuration]}
							min={0}
							max={5}
							step={0.1}
							onValueChange={([v]) => handleDurationChange(v)}
						/>
					</PropertyItemValue>
				</PropertyItem>
			)}

			{hasIntensityControl && (
				<PropertyItem direction="column">
					<PropertyItemLabel>
						{t("Intensity")}
						<span className="text-muted-foreground ml-1 text-xs">
							{Math.round(currentIntensity * 100)}%
						</span>
					</PropertyItemLabel>
					<PropertyItemValue>
						<Slider
							value={[currentIntensity]}
							min={0}
							max={1}
							step={0.05}
							onValueChange={([v]) => handleIntensityChange(v)}
						/>
					</PropertyItemValue>
				</PropertyItem>
			)}
		</>
	);
}
