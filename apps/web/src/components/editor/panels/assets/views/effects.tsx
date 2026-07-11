"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditor } from "@/hooks/use-editor";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";
import {
	FILTER_PRESETS,
	type FilterPreset,
} from "@/constants/filter-constants";
import { toast } from "sonner";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

const BLUR_PRESETS = FILTER_PRESETS.filter((p) => p.category === "blur");

export function EffectsView() {
	const { t } = useTranslation();

	return (
		<div className="flex h-full flex-col">
			<div className="border-b px-4 pt-3 pb-2">
				<h3 className="mb-2 text-sm font-medium">{t("Effects")}</h3>
				<p className="text-muted-foreground text-xs">
					{t("Apply an effect to the selected clip.")}
				</p>
			</div>
			<ScrollArea className="flex-1">
				<div className="grid grid-cols-2 gap-2 p-4">
					{BLUR_PRESETS.map((preset) => (
						<EffectPresetCard key={preset.id} preset={preset} />
					))}
				</div>
			</ScrollArea>
		</div>
	);
}

function EffectPresetCard({ preset }: { preset: FilterPreset }) {
	const { t } = useTranslation();
	const editor = useEditor();
	const { selectedElements } = useElementSelection();

	const handleApplyEffect = () => {
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
						onClick={handleApplyEffect}
					>
						<EffectPreview preset={preset} />
						<span className="text-xs font-medium">{preset.name}</span>
					</button>
				</TooltipTrigger>
				<TooltipContent>
					<p>
						{t("Apply {{name}} effect to selected clips", {
							name: preset.name,
						})}
					</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function EffectPreview({ preset }: { preset: FilterPreset }) {
	const gradientId = `effect-grad-${preset.id}`;

	return (
		<svg
			width={120}
			height={40}
			viewBox="0 0 120 40"
			className="h-10 w-full rounded"
			role="img"
			aria-label={preset.name}
		>
			<defs>
				<linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
					<stop offset="0%" stopColor="#6366f1" />
					<stop offset="50%" stopColor="#ec4899" />
					<stop offset="100%" stopColor="#f59e0b" />
				</linearGradient>
			</defs>
			<rect width={120} height={40} fill={`url(#${gradientId})`} rx={4} />
			<rect
				width={120}
				height={40}
				fill="currentColor"
				className="text-foreground"
				opacity={0.06}
				rx={4}
				style={{ filter: preset.cssFilter }}
			/>
		</svg>
	);
}
