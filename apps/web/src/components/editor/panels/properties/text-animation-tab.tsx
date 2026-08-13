"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
	DEFAULT_DURATION,
	DEFAULT_INTENSITY,
} from "@/lib/timeline/text-animation-utils";
import type {
	TextAnimation,
	TextAnimationPhase,
	TextAnimations,
	TextAnimationType,
	TextElement,
} from "@/types/timeline";
import { cn } from "@/utils/ui";
import { TextAnimationPreview } from "./text-animation-preview";
import { TextAnimationRow } from "./text-animation-row";

interface TextAnimationTabProps {
	element: TextElement;
	/** Commit a new animations value. */
	onChange: (animations: TextAnimations | undefined) => void;
}

/** Presets available in each phase. Karaoke/loop omitted (no render path here). */
const IN_TYPES: TextAnimationType[] = [
	"none",
	"typewriter",
	"fade-in",
	"slide-in",
	"scale-in",
];
const OUT_TYPES: TextAnimationType[] = ["none", "fade-out", "slide-out"];

/**
 * "Animation" tab for text properties. Splits into two sub-tabs:
 *   - **In**  — entrance effects played from the element's start.
 *   - **Out** — exit effects played over the element's final seconds.
 *
 * Each sub-tab shows a grid of preset cards whose mini canvases preview the
 * effect on hover, plus duration/intensity sliders for the selected preset.
 */
export function TextAnimationTab({ element, onChange }: TextAnimationTabProps) {
	const { t } = useTranslation();
	const animations = element.textAnimations;

	return (
		<Tabs defaultValue="in" className="flex h-full flex-col">
			<TabsList className="border-b px-3 py-2">
				<TabsTrigger value="in">{t("In")}</TabsTrigger>
				<TabsTrigger value="out">{t("Out")}</TabsTrigger>
			</TabsList>
			<TabsContent value="in" className="mt-0 flex-1 overflow-auto">
				<PresetGrid
					phase="in"
					types={IN_TYPES}
					current={animations?.in?.type ?? "none"}
					element={element}
					onSelect={(type) =>
						applyPhase(onChange, animations, "in", type)
					}
				/>
				{animations?.in && (
					<TextAnimationRow
						animation={animations.in}
						onChange={(next) =>
							onChange({ ...animations, in: next })
						}
					/>
				)}
			</TabsContent>
			<TabsContent value="out" className="mt-0 flex-1 overflow-auto">
				<PresetGrid
					phase="out"
					types={OUT_TYPES}
					current={animations?.out?.type ?? "none"}
					element={element}
					onSelect={(type) =>
						applyPhase(onChange, animations, "out", type)
					}
				/>
				{animations?.out && (
					<TextAnimationRow
						animation={animations.out}
						onChange={(next) =>
							onChange({ ...animations, out: next })
						}
					/>
				)}
			</TabsContent>
		</Tabs>
	);
}

/** Set or clear a single phase, preserving the other phase. */
function applyPhase(
	onChange: (animations: TextAnimations | undefined) => void,
	current: TextAnimations | undefined,
	phase: TextAnimationPhase,
	type: TextAnimationType,
) {
	if (type === "none") {
		// Clear this phase; drop the whole object if both are now empty.
		const next: TextAnimations = { ...current };
		delete next[phase];
		if (!next.in && !next.out) {
			onChange(undefined);
			return;
		}
		onChange(next);
		return;
	}
	onChange({
		...current,
		[phase]: {
			type,
			duration: DEFAULT_DURATION[type] ?? 1,
			intensity: DEFAULT_INTENSITY[type],
		} satisfies TextAnimation,
	});
}

function PresetGrid({
	phase,
	types,
	current,
	element,
	onSelect,
}: {
	phase: TextAnimationPhase;
	types: TextAnimationType[];
	current: TextAnimationType;
	element: TextElement;
	onSelect: (type: TextAnimationType) => void;
}) {
	const { t } = useTranslation();
	const [hoveredType, setHoveredType] = useState<TextAnimationType | null>(
		null,
	);

	return (
		<div className="grid grid-cols-2 gap-2 p-3">
			{types.map((type) => {
				const isSelected = current === type;
				const isHovering = hoveredType === type;
				return (
					<button
						key={type}
						type="button"
						className={cn(
							"group bg-muted hover:bg-accent relative flex flex-col items-center gap-1.5 rounded-lg border p-2",
							"transition-all duration-200 motion-reduce:transition-none",
							"hover:scale-[1.03] hover:shadow-lg",
							"motion-reduce:hover:scale-100",
							isSelected &&
								"ring-2 ring-primary shadow-md motion-reduce:scale-100",
						)}
						onMouseEnter={() => setHoveredType(type)}
						onMouseLeave={() =>
							setHoveredType((cur) =>
								cur === type ? null : cur,
							)
						}
						onClick={() => onSelect(type)}
					>
						<TextAnimationPreview
							type={type}
							phase={phase}
							isHovering={isHovering}
							sampleText={element.content}
						/>
						<span className="text-xs font-medium">
							{getTypeLabel(t, type)}
						</span>
					</button>
				);
			})}
		</div>
	);
}

/**
 * Map a type to its display label. Each branch uses a literal `t("…")` call so
 * the i18next-toolkit scanner can statically extract every key.
 */
function getTypeLabel(
	t: (key: string) => string,
	type: TextAnimationType,
): string {
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
}
