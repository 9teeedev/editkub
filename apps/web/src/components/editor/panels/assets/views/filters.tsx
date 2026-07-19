"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditor } from "@/hooks/use-editor";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";
import {
	FILTER_PRESETS,
	FILTER_CATEGORIES,
	FILTER_CATEGORY_LABELS,
	type FilterPreset,
} from "@/constants/filter-constants";
import { toast } from "sonner";
import { cn } from "@/utils/ui";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

export function FiltersView() {
	const { t } = useTranslation();
	const [selectedCategory, setSelectedCategory] = useState<string>("all");

	const filteredPresets =
		selectedCategory === "all"
			? FILTER_PRESETS
			: FILTER_PRESETS.filter(
					(preset) => preset.category === selectedCategory,
				);

	return (
		<div className="flex h-full flex-col">
			<div className="border-b px-4 pt-3 pb-2">
				<h3 className="mb-2 text-sm font-medium">{t("Filters")}</h3>
				<p className="text-muted-foreground mb-2 text-xs">
					{t("Apply a filter to the selected clip.")}
				</p>
				<div className="flex flex-wrap gap-1">
					<CategoryPill
						label={t("All")}
						isActive={selectedCategory === "all"}
						onClick={() => setSelectedCategory("all")}
					/>
					{FILTER_CATEGORIES.map((category) => (
						<CategoryPill
							key={category}
							label={t(FILTER_CATEGORY_LABELS[category])}
							isActive={selectedCategory === category}
							onClick={() => setSelectedCategory(category)}
						/>
					))}
				</div>
			</div>
			<ScrollArea className="flex-1">
				<div className="grid grid-cols-2 gap-2 p-4">
					{filteredPresets.map((preset) => (
						<FilterPresetCard key={preset.id} preset={preset} />
					))}
				</div>
			</ScrollArea>
		</div>
	);
}

function CategoryPill({
	label,
	isActive,
	onClick,
}: {
	label: string;
	isActive: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			className={cn(
				"rounded-full px-3 py-1 text-xs font-medium transition-colors",
				isActive
					? "bg-primary text-primary-foreground"
					: "bg-muted text-muted-foreground hover:bg-accent",
			)}
			onClick={onClick}
		>
			{label}
		</button>
	);
}

function FilterPresetCard({ preset }: { preset: FilterPreset }) {
	const { t } = useTranslation();
	const editor = useEditor();
	const { selectedElements } = useElementSelection();

	const handleApplyFilter = () => {
		if (selectedElements.length === 0) {
			toast.info(t("Select a clip first"));
			return;
		}

		for (const { trackId, elementId } of selectedElements) {
			editor.timeline.updateElements({
				updates: [
					{
						trackId,
						elementId,
						updates: {
							filter: { presetId: preset.id, intensity: 1 },
						},
					},
				],
				pushHistory: true,
			});
		}
	};

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						className="bg-muted hover:bg-accent flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors"
						onClick={handleApplyFilter}
					>
						<FilterPreview preset={preset} />
						<span className="text-xs font-medium">{preset.name}</span>
					</button>
				</TooltipTrigger>
				<TooltipContent>
					<p>
						{t("Apply {{name}} filter to selected clips", {
							name: preset.name,
						})}
					</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function FilterPreview({ preset }: { preset: FilterPreset }) {
	// ponytail: simple gradient + overlay thumbnail, no canvas needed
	const gradientId = `filter-grad-${preset.id}`;

	return (
		<svg
			width={120}
			height={40}
			viewBox="0 0 120 40"
			className="h-10 w-full rounded"
		>
			<defs>
				<linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
					<stop offset="0%" stopColor="#6366f1" />
					<stop offset="50%" stopColor="#ec4899" />
					<stop offset="100%" stopColor="#f59e0b" />
				</linearGradient>
			</defs>
			<rect width={120} height={40} fill={`url(#${gradientId})`} rx={4} />
			{preset.previewOverlay && (
				<rect
					width={120}
					height={40}
					fill={preset.previewOverlay.color}
					opacity={preset.previewOverlay.opacity}
					rx={4}
				/>
			)}
			{preset.id === "bw" && (
				<rect
					width={120}
					height={40}
					fill="currentColor"
					className="text-foreground"
					opacity={0.08}
					rx={4}
				/>
			)}
		</svg>
	);
}
