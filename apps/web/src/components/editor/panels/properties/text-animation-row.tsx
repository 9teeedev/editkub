"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
	PropertyGroup,
	PropertyItem,
	PropertyItemLabel,
	PropertyItemValue,
} from "./property-item";
import {
	DEFAULT_DURATION,
	DEFAULT_INTENSITY,
	TEXT_ANIMATION_TYPES,
	TEXT_ANIMATION_CATEGORIES,
} from "@/lib/timeline/text-animation-utils";
import type { TextAnimation, TextAnimationType } from "@/types/timeline";

interface TextAnimationRowProps {
	/** Current animation value on the element (undefined = none). */
	animation: TextAnimation | undefined;
	/** Commit a new animation value (or undefined to clear). */
	onChange: (animation: TextAnimation | undefined) => void;
}

/**
 * Property group for the per-element text animation (typewriter, fade, slide,
 * bounce, glitch, karaoke). Lives inside the text properties "Style" tab.
 */
export function TextAnimationRow({ animation, onChange }: TextAnimationRowProps) {
	const { t } = useTranslation();

	const currentType: TextAnimationType = animation?.type ?? "none";
	const currentDuration = animation?.duration ?? 0;
	const currentIntensity = animation?.intensity ?? 1;

	const handleTypeChange = (type: TextAnimationType) => {
		if (type === "none") {
			onChange(undefined);
			return;
		}
		onChange({
			type,
			duration: DEFAULT_DURATION[type] ?? 1,
			intensity: DEFAULT_INTENSITY[type],
		});
	};

	const handleDurationChange = (duration: number) => {
		if (!animation) return;
		onChange({ ...animation, duration });
	};

	const handleIntensityChange = (intensity: number) => {
		if (!animation) return;
		onChange({ ...animation, intensity });
	};

	// Group types by category for the dropdown.
	const grouped = TEXT_ANIMATION_TYPES.reduce<
		Record<string, TextAnimationType[]>
	>((acc, type) => {
		const category = TEXT_ANIMATION_CATEGORIES[type];
		(acc[category] ??= []).push(type);
		return acc;
	}, {});

	const hasDurationControl =
		animation !== undefined && animation.type !== "karaoke";
	const hasIntensityControl =
		animation !== undefined &&
		(animation.type === "glitch" ||
			animation.type === "bounce" ||
			animation.type === "slide-in" ||
			animation.type === "slide-out");

	return (
		<PropertyGroup title={t("Animation")} collapsible={false}>
			<PropertyItem direction="column">
				<PropertyItemLabel>{t("Effect")}</PropertyItemLabel>
				<PropertyItemValue>
					<Select
						value={currentType}
						onValueChange={(v) =>
							handleTypeChange(v as TextAnimationType)
						}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder={t("None")} />
						</SelectTrigger>
						<SelectContent>
							{Object.entries(grouped).map(([category, types]) => (
								<CategoryGroup
									key={category}
									category={category}
									types={types}
								/>
							))}
						</SelectContent>
					</Select>
				</PropertyItemValue>
			</PropertyItem>

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
		</PropertyGroup>
	);
}

/**
 * Translate an animation type to its display label. Each branch uses a literal
 * string argument so the i18next-toolkit scanner can statically extract it.
 */
function useTypeLabel() {
	const { t } = useTranslation();
	return (type: TextAnimationType): string => {
		if (type === "none") return t("None");
		if (type === "typewriter") return t("Typewriter");
		if (type === "fade-in") return t("Fade In");
		if (type === "fade-out") return t("Fade Out");
		if (type === "slide-in") return t("Slide In");
		if (type === "slide-out") return t("Slide Out");
		if (type === "scale-in") return t("Scale In");
		if (type === "bounce") return t("Bounce");
		if (type === "glitch") return t("Glitch");
		return t("Karaoke");
	};
}

/** Translate a category name to its display label (literal string per branch). */
function useCategoryLabel() {
	const { t } = useTranslation();
	return (category: string): string => {
		if (category === "none") return t("None");
		if (category === "entrance") return t("Entrance");
		if (category === "exit") return t("Exit");
		if (category === "loop") return t("Loop");
		return t("Highlight");
	};
}

function CategoryGroup({
	category,
	types,
}: {
	category: string;
	types: TextAnimationType[];
}) {
	const getCategoryLabel = useCategoryLabel();
	const getTypeLabel = useTypeLabel();
	const headerLabel = getCategoryLabel(category);

	return (
		<div key={category}>
			<div className="text-muted-foreground px-2 py-1 text-xs font-medium uppercase tracking-wide">
				{headerLabel}
			</div>
			{types.map((type) => (
				<SelectItem key={type} value={type}>
					{getTypeLabel(type)}
				</SelectItem>
			))}
		</div>
	);
}
