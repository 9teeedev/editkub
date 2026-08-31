"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import { HugeiconsIcon } from "@hugeicons/react";
import { BlurIcon, SlidersVerticalIcon } from "@hugeicons/core-free-icons";
import { useEditor } from "@/hooks/use-editor";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";
import {
	buildAdjustmentElement,
	buildBlurEffectElement,
} from "@/lib/timeline/element-utils";
import { applyVideoEffect, VFX_PRESETS, type VfxPreset } from "@/lib/renderer/video-effects";
import { createCanvas } from "@/lib/renderer/chroma-key";
import { toast } from "sonner";
import { cn } from "@/utils/ui";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

export function EffectsView() {
	const { t } = useTranslation();
	const editor = useEditor();

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
					{VFX_PRESETS.map((preset) => (
						<VfxPresetCard key={preset.id} preset={preset} />
					))}
					<DraggableItem
						name="Blur"
						dragData={{
							id: "blur-effect",
							type: "blur-effect",
							name: "Blur",
							blurIntensity: 50,
						}}
						aspectRatio={16 / 9}
						preview={<BlurPreview />}
						shouldShowLabel={true}
						containerClassName="w-full"
						onAddToTimeline={({ currentTime }) => {
							const element = buildBlurEffectElement({
								startTime: currentTime,
							});
							editor.timeline.insertElement({
								element,
								placement: { mode: "auto" },
							});
						}}
					/>
					<DraggableItem
						name={t("Adjustment")}
						dragData={{
							id: "adjustment",
							type: "adjustment",
							name: "Adjustment layer",
						}}
						aspectRatio={16 / 9}
						preview={<AdjustmentPreview />}
						shouldShowLabel={true}
						containerClassName="w-full"
						onAddToTimeline={({ currentTime }) => {
							const element = buildAdjustmentElement({
								startTime: currentTime,
							});
							editor.timeline.insertElement({
								element,
								placement: { mode: "auto" },
							});
						}}
					/>
				</div>
			</ScrollArea>
		</div>
	);
}

function VfxPresetCard({ preset }: { preset: VfxPreset }) {
	const { t } = useTranslation();
	const editor = useEditor();
	const { selectedElements } = useElementSelection();
	const [isHovering, setIsHovering] = useState(false);

	const apply = () => {
		const updates = editor.timeline
			.getElementsWithTracks({ elements: selectedElements })
			.filter(
				({ element }) => element.type === "video" || element.type === "image",
			)
			.map(({ track, element }) => ({
				trackId: track.id,
				elementId: element.id,
				updates: {
					videoEffect:
						preset.id === "none"
							? undefined
							: { effect: preset.id, intensity: 0.5 },
				},
			}));

		if (updates.length === 0) {
			toast.info(t("Select a video or image clip first"));
			return;
		}

		editor.timeline.updateElements({ updates, pushHistory: true });
	};

	const label = vfxPresetLabel(preset.id, t);

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
						onClick={apply}
					>
						<VfxPreview preset={preset} isHovering={isHovering} />
						<span className="text-xs font-medium">{label}</span>
					</button>
				</TooltipTrigger>
				<TooltipContent>
					<p>
						{t("Apply {{name}} effect to selected clips", { name: label })}
					</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function VfxPreview({
	preset,
	isHovering,
}: {
	preset: VfxPreset;
	isHovering: boolean;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const width = 240;
		const height = 135;
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d");
		if (!context) return;

		const source = createCanvas({ width, height });
		const target = createCanvas({ width, height });
		const sourceContext = source.getContext("2d") as CanvasRenderingContext2D | null;
		if (!sourceContext) return;

		let frame = 0;
		let animationFrame = 0;
		let cancelled = false;

		const draw = () => {
			if (cancelled) return;
			drawPreviewScene(sourceContext, width, height, frame);
			applyVideoEffect({
				source,
				sourceWidth: width,
				sourceHeight: height,
				config: { effect: preset.id, intensity: 0.8 },
				target,
			});
			context.clearRect(0, 0, width, height);
			context.drawImage(target, 0, 0, width, height);
			frame++;
			if (isHovering && preset.id !== "none") {
				animationFrame = requestAnimationFrame(draw);
			}
		};

		draw();
		return () => {
			cancelled = true;
			cancelAnimationFrame(animationFrame);
		};
	}, [isHovering, preset.id]);

	return <canvas ref={canvasRef} className="h-14 w-full rounded" />;
}

function drawPreviewScene(
	context: CanvasRenderingContext2D,
	width: number,
	height: number,
	frame: number,
) {
	const gradient = context.createLinearGradient(0, 0, width, height);
	gradient.addColorStop(0, "#172554");
	gradient.addColorStop(0.5, "#7c3aed");
	gradient.addColorStop(1, "#be123c");
	context.fillStyle = gradient;
	context.fillRect(0, 0, width, height);

	context.fillStyle = "rgba(255,255,255,0.14)";
	for (let x = -height; x < width + height; x += 18) {
		context.save();
		context.translate((frame % 18) - 18, 0);
		context.rotate(-0.45);
		context.fillRect(x, -height, 7, height * 3);
		context.restore();
	}

	context.fillStyle = "#fbbf24";
	context.beginPath();
	context.arc(width * 0.28, height * 0.52, height * 0.27, 0, Math.PI * 2);
	context.fill();
	context.fillStyle = "#22d3ee";
	context.fillRect(width * 0.55, height * 0.22, width * 0.25, height * 0.55);
	context.fillStyle = "rgba(15,23,42,0.72)";
	context.fillRect(width * 0.08, height * 0.8, width * 0.84, height * 0.1);
}

function vfxPresetLabel(id: VfxPreset["id"], t: (key: string) => string) {
	switch (id) {
		case "none":
			return t("None");
		case "glitch":
			return t("Glitch");
		case "vhs":
			return t("VHS");
		case "pixelate":
			return t("Pixelate");
		case "rgb-split":
			return t("RGB Split");
		case "halftone":
			return t("Halftone");
	}
}

function BlurPreview() {
	return (
		<div className="relative size-full">
			<div
				className="size-full rounded-sm"
				style={{
					background:
						"linear-gradient(135deg, #6366f1 0%, #ec4899 50%, #f59e0b 100%)",
				}}
			/>
			<div
				className="absolute inset-0 flex items-center justify-center rounded-sm"
				style={{ backdropFilter: "blur(6px)" }}
			>
				<HugeiconsIcon icon={BlurIcon} className="text-white/80 size-8" />
			</div>
		</div>
	);
}

function AdjustmentPreview() {
	return (
		<div className="relative size-full">
			<div
				className="size-full rounded-sm"
				style={{
					background:
						"linear-gradient(135deg, #f43f5e 0%, #f59e0b 50%, #3b82f6 100%)",
					filter: "saturate(1.6) contrast(1.15) brightness(1.05)",
				}}
			/>
			<div className="absolute inset-0 flex items-center justify-center rounded-sm bg-black/25">
				<HugeiconsIcon
					icon={SlidersVerticalIcon}
					className="size-8 text-white/90"
				/>
			</div>
		</div>
	);
}
