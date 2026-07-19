"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { useState, useRef, useEffect, useMemo } from "react";
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
	const [isHovering, setIsHovering] = useState(false);

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
						className={cn(
							"group bg-muted hover:bg-accent relative flex flex-col items-center gap-2 rounded-lg border p-3",
							"transition-all duration-200 motion-reduce:transition-none",
							"hover:scale-[1.03] hover:shadow-lg hover:ring-1 hover:ring-primary",
							"motion-reduce:hover:scale-100",
							isHovering &&
								"scale-[1.03] shadow-lg ring-1 ring-primary motion-reduce:scale-100",
						)}
						onMouseEnter={() => setIsHovering(true)}
						onMouseLeave={() => setIsHovering(false)}
						onClick={handleApplyFilter}
					>
						<FilterPreview preset={preset} isHovering={isHovering} />
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

const SCENE_URL = "/preview/filters/scene.svg";

// Module-level cache: single SVG shared across all FilterPreview instances.
// Loaded once on first use, reused for every card after.
let cachedScene: HTMLImageElement | null = null;
let loadPromise: Promise<HTMLImageElement> | null = null;

function loadScene(): Promise<HTMLImageElement> {
	if (cachedScene) return Promise.resolve(cachedScene);
	if (loadPromise) return loadPromise;

	loadPromise = new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			cachedScene = img;
			resolve(img);
		};
		img.onerror = () => {
			loadPromise = null; // allow retry on next attempt
			reject(new Error(`Failed to load ${SCENE_URL}`));
		};
		img.src = SCENE_URL;
	});
	return loadPromise;
}

function FilterPreview({
	preset,
	isHovering,
}: {
	preset: FilterPreset;
	isHovering: boolean;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	// ponytail: detect reduced-motion once on mount — if set, always show the
	// filter applied so the effect is still legible without requiring hover.
	const reducedMotion = useMemo(
		() =>
			typeof window !== "undefined" &&
			window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
		[],
	);

	// "none" preset is the Original baseline — never apply a filter.
	const shouldApply =
		preset.id !== "none" && preset.cssFilter !== "none"
			? isHovering || reducedMotion
			: false;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		const CSS_W = canvas.clientWidth;
		const CSS_H = canvas.clientHeight;
		if (CSS_W === 0 || CSS_H === 0) return;
		canvas.width = CSS_W * dpr;
		canvas.height = CSS_H * dpr;
		ctx.scale(dpr, dpr);

		const W = CSS_W;
		const H = CSS_H;

		let cancelled = false;

		const draw = (img: HTMLImageElement) => {
			if (cancelled) return;
			ctx.clearRect(0, 0, W, H);
			ctx.save();
			// Apply the preset's real CSS filter string — same path as VisualNode.renderVisual.
			if (shouldApply) {
				ctx.filter = preset.cssFilter;
			}
			ctx.drawImage(img, 0, 0, W, H);
			ctx.restore();
		};

		loadScene()
			.then((img) => draw(img))
			.catch(() => {
				// Asset failed to load — canvas stays blank, no crash.
			});

		return () => {
			cancelled = true;
		};
	}, [preset.cssFilter, shouldApply]);

	return <canvas ref={canvasRef} className="h-14 w-full rounded" />;
}
