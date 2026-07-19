"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { useState, useRef, useEffect, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditor } from "@/hooks/use-editor";
import {
	TRANSITION_PRESETS,
	TRANSITION_CATEGORIES,
	TRANSITION_CATEGORY_LABELS,
	DEFAULT_TRANSITION_DURATION,
	type TransitionPreset,
} from "@/constants/transition-constants";
import type { TransitionType, VideoTrack } from "@/types/timeline";
import { toast } from "sonner";
import { cn } from "@/utils/ui";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { findAdjacentPairs } from "@/lib/timeline/transition-utils";

export function TransitionsView() {
	const { t } = useTranslation();
	const [selectedCategory, setSelectedCategory] = useState<string>("all");

	const filteredPresets =
		selectedCategory === "all"
			? TRANSITION_PRESETS
			: TRANSITION_PRESETS.filter(
					(preset) => preset.category === selectedCategory,
				);

	return (
		<div className="flex h-full flex-col">
			<div className="border-b px-4 pt-3 pb-2">
				<h3 className="mb-2 text-sm font-medium">{t("Transitions")}</h3>
				<p className="text-muted-foreground mb-2 text-xs">
					{t(
						"Click a transition to apply it to adjacent clips. You can also click the junction icon between clips on the timeline.",
					)}
				</p>
				<div className="flex flex-wrap gap-1">
					<CategoryPill
						label={t("All")}
						isActive={selectedCategory === "all"}
						onClick={() => setSelectedCategory("all")}
					/>
					{TRANSITION_CATEGORIES.map((category) => (
						<CategoryPill
							key={category}
							label={t(TRANSITION_CATEGORY_LABELS[category])}
							isActive={selectedCategory === category}
							onClick={() => setSelectedCategory(category)}
						/>
					))}
				</div>
			</div>
			<ScrollArea className="flex-1">
				<div className="grid grid-cols-2 gap-2 p-4">
					{filteredPresets.map((preset) => (
						<TransitionPresetCard key={preset.type} preset={preset} />
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

function TransitionPresetCard({ preset }: { preset: TransitionPreset }) {
	const { t } = useTranslation();
	const editor = useEditor();
	const [isHovering, setIsHovering] = useState(false);

	const handleApplyTransition = () => {
		applyTransitionToAdjacentPairs({
			t,
			editor,
			transitionType: preset.type,
		});
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
						onClick={handleApplyTransition}
					>
						<TransitionPreview type={preset.type} isHovering={isHovering} />
						<span className="text-xs font-medium">{preset.label}</span>
					</button>
				</TooltipTrigger>
				<TooltipContent>
					<p>
						{t("Apply {{name}} transition to all adjacent clip junctions", {
							name: preset.label,
						})}
					</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

const SCENE_A_URL = "/preview/transitions/scene-a.svg";
const SCENE_B_URL = "/preview/transitions/scene-b.svg";

// Module-level cache: SVG images shared across all TransitionPreview instances.
// Loaded once on first use, reused for every card after.
let cachedSceneA: HTMLImageElement | null = null;
let cachedSceneB: HTMLImageElement | null = null;
let loadPromise: Promise<{ a: HTMLImageElement; b: HTMLImageElement }> | null = null;

function loadScenes(): Promise<{ a: HTMLImageElement; b: HTMLImageElement }> {
	if (cachedSceneA && cachedSceneB) {
		return Promise.resolve({ a: cachedSceneA, b: cachedSceneB });
	}
	if (loadPromise) return loadPromise;

	loadPromise = new Promise((resolve, reject) => {
		const mk = (src: string) =>
			new Promise<HTMLImageElement>((res, rej) => {
				const img = new Image();
				img.onload = () => res(img);
				img.onerror = () => rej(new Error(`Failed to load ${src}`));
				img.src = src;
			});
		Promise.all([mk(SCENE_A_URL), mk(SCENE_B_URL)]).then(
			([a, b]) => {
				cachedSceneA = a;
				cachedSceneB = b;
				resolve({ a, b });
			},
			(err) => {
				loadPromise = null; // allow retry on next attempt
				reject(err);
			},
		);
	});
	return loadPromise;
}

// Smoothstep easing — matches the real renderer's `applyDissolve`.
const smoothstep = (t: number) => t * t * (3 - 2 * t);

function TransitionPreview({
	type,
	isHovering,
}: {
	type: TransitionType;
	isHovering: boolean;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const rafRef = useRef<number>(0);

	// ponytail: detect reduced-motion once on mount — if set, freeze at progress=0.5
	// (mid-crossfade) so the user still sees both scenes without motion.
	const reducedMotion = useMemo(
		() =>
			typeof window !== "undefined" &&
			window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
		[],
	);

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

		// drawFrame renders a single transition frame at `progress` ∈ [0,1].
		// Easing matches transition-node.ts: dissolve uses smoothstep, all others linear.
		const drawFrame = (imgA: HTMLImageElement, imgB: HTMLImageElement, progress: number) => {
			ctx.clearRect(0, 0, W, H);
			ctx.save();

			if (type === "fade" || type === "dissolve") {
				const eased = type === "dissolve" ? smoothstep(progress) : progress;
				ctx.globalAlpha = 1 - eased;
				ctx.drawImage(imgA, 0, 0, W, H);
				ctx.globalAlpha = eased;
				ctx.drawImage(imgB, 0, 0, W, H);
			} else if (type.startsWith("wipe-")) {
				const dir = type.replace("wipe-", "");
				ctx.drawImage(imgA, 0, 0, W, H);
				ctx.save();
				ctx.beginPath();
				if (dir === "left") ctx.rect(W * (1 - progress), 0, W * progress, H);
				else if (dir === "right") ctx.rect(0, 0, W * progress, H);
				else if (dir === "up") ctx.rect(0, H * (1 - progress), W, H * progress);
				else ctx.rect(0, 0, W, H * progress);
				ctx.clip();
				ctx.drawImage(imgB, 0, 0, W, H);
				ctx.restore();
			} else if (type.startsWith("slide-")) {
				const dir = type.replace("slide-", "");
				let ox = 0;
				let oy = 0;
				if (dir === "left") ox = -W * progress;
				else if (dir === "right") ox = W * progress;
				else if (dir === "up") oy = -H * progress;
				else oy = H * progress;
				ctx.drawImage(imgA, ox, oy, W, H);
				const bx = dir === "left" ? W + ox : dir === "right" ? -W + ox : 0;
				const by = dir === "up" ? H + oy : dir === "down" ? -H + oy : 0;
				ctx.drawImage(imgB, bx, by, W, H);
			} else if (type === "zoom-in") {
				ctx.drawImage(imgB, 0, 0, W, H);
				const s = 1 + progress * 0.5;
				const sw = W * s;
				const sh = H * s;
				ctx.globalAlpha = 1 - progress;
				ctx.drawImage(imgA, (W - sw) / 2, (H - sh) / 2, sw, sh);
			} else if (type === "zoom-out") {
				ctx.drawImage(imgA, 0, 0, W, H);
				const s = 1 - progress * 0.5;
				const sw = W * s;
				const sh = H * s;
				ctx.globalAlpha = progress;
				ctx.drawImage(imgB, (W - sw) / 2, (H - sh) / 2, sw, sh);
			} else {
				ctx.drawImage(imgA, 0, 0, W, H);
				ctx.drawImage(imgB, 0, 0, W, H);
			}
			ctx.restore();
		};

		let cancelled = false;

		// Reduced motion: freeze at mid-crossfade so both scenes are visible.
		if (reducedMotion) {
			loadScenes()
				.then(({ a, b }) => {
					if (cancelled) return;
					drawFrame(a, b, 0.5);
				})
				.catch(() => {
					// Asset failed to load — canvas stays blank, no crash.
				});
			return () => {
				cancelled = true;
			};
		}

		// ponytail: ping-pong loop — progress goes 0→1→0 across DURATION, no jarring
		// restart at the loop boundary.
		const DURATION = 2400;
		const HALF = DURATION / 2;
		let start = 0;

		const draw = (imgA: HTMLImageElement, imgB: HTMLImageElement) => {
			if (!isHovering) {
				// Idle: show scene A only — clear sign of "source clip".
				drawFrame(imgA, imgB, 0);
				return;
			}

			const tick = (t: number) => {
				if (cancelled) return;
				if (!start) start = t;
				const cycle = (t - start) % DURATION;
				const progress = cycle < HALF ? cycle / HALF : 2 - cycle / HALF;
				drawFrame(imgA, imgB, progress);
				rafRef.current = requestAnimationFrame(tick);
			};
			rafRef.current = requestAnimationFrame(tick);
		};

		let subscribed = true;
		loadScenes()
			.then(({ a, b }) => {
				if (cancelled || !subscribed) return;
				draw(a, b);
			})
			.catch(() => {
				// Asset failed to load — canvas stays blank, no crash.
			});

		return () => {
			cancelled = true;
			subscribed = false;
			cancelAnimationFrame(rafRef.current);
		};
	}, [type, isHovering, reducedMotion]);

	return <canvas ref={canvasRef} className="h-14 w-full rounded" />;
}

function applyTransitionToAdjacentPairs({
	t,
	editor,
	transitionType,
}: {
	t: (key: string, options?: Record<string, unknown>) => string;
	editor: ReturnType<typeof useEditor>;
	transitionType: TransitionType;
}) {
	const tracks = editor.timeline.getTracks();
	let applied = 0;

	for (const track of tracks) {
		if (track.type !== "video") continue;

		const videoTrack = track as VideoTrack;
		const pairs = findAdjacentPairs({ track: videoTrack });

		for (const pair of pairs) {
			const result = editor.timeline.addTransition({
				trackId: track.id,
				fromElementId: pair.from.id,
				toElementId: pair.to.id,
				type: transitionType,
				duration: DEFAULT_TRANSITION_DURATION,
			});
			if (result) applied++;
		}
	}

	if (applied === 0) {
		toast.info(
			t(
				"No adjacent clips found. Place clips next to each other on a video track first.",
			),
		);
	} else {
		toast.success(
			t("Applied {{type}} to {{num}} junction(s)", {
				type: transitionType,
				num: applied,
			}),
		);
	}
}
