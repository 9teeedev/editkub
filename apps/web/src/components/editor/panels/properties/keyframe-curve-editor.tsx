"use client";

import { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { cn } from "@/utils/ui";
import { applyEasing } from "@/lib/timeline/keyframe-utils";
import type { Easing, Keyframe } from "@/types/timeline";

/**
 * Named easing presets for the selector row. Mirrors the internal map in
 * keyframe-utils as an ordered array for UI rendering.
 */
const EASING_PRESET_LIST: {
	id: Exclude<Easing, "bezier">;
	p1: { x: number; y: number };
	p2: { x: number; y: number };
}[] = [
	{ id: "linear", p1: { x: 0, y: 0 }, p2: { x: 1, y: 1 } },
	{ id: "ease-in", p1: { x: 0.42, y: 0 }, p2: { x: 1, y: 1 } },
	{ id: "ease-out", p1: { x: 0, y: 0 }, p2: { x: 0.58, y: 1 } },
	{ id: "ease-in-out", p1: { x: 0.42, y: 0 }, p2: { x: 0.58, y: 1 } },
];

const PLOT_SIZE = 160; // px, square plot area
const HANDLE_RADIUS = 6;

/**
 * Visual easing-curve editor for a single keyframe.
 *
 * The keyframe's easing drives the segment *leaving* it (i.e. toward the
 * next keyframe). The plot is normalized time (x, [0,1]) → eased value
 * (y, [0,1], y-axis flipped). Two draggable handles set the cubic-bezier
 * control points P1/P2 when `easing === "bezier"`.
 *
 * For named presets the curve is drawn read-only; selecting a preset
 * commits the new `easing`. Selecting "bezier" (via the custom handle drag
 * or a dedicated button) makes the handles editable.
 */
export function KeyframeCurveEditor({
	keyframe,
	onChange,
}: {
	keyframe: Keyframe;
	onChange: (patch: Partial<Keyframe>) => void;
}) {
	const { t } = useTranslation();
	const svgRef = useRef<SVGSVGElement>(null);

	// Resolve the effective control points (bezier fields or preset defaults).
	const { p1, p2 } = useMemo(() => {
		if (keyframe.easing === "bezier") {
			return {
				p1: keyframe.bezierP1 ?? { x: 0.33, y: 0 },
				p2: keyframe.bezierP2 ?? { x: 0.67, y: 1 },
			};
		}
		if (keyframe.easing === "linear") {
			return { p1: { x: 0, y: 0 }, p2: { x: 1, y: 1 } };
		}
		const preset = EASING_PRESET_LIST.find((p) => p.id === keyframe.easing);
		return preset ?? { p1: { x: 0.33, y: 0 }, p2: { x: 0.67, y: 1 } };
	}, [keyframe.easing, keyframe.bezierP1, keyframe.bezierP2]);

	const isCustom = keyframe.easing === "bezier";

	// Build the curve path by sampling the easing function over x=[0,1].
	const pathD = useMemo(() => {
		const steps = 48;
		const pts: string[] = [];
		for (let i = 0; i <= steps; i++) {
			const x = i / steps;
			const y = applyEasing(x, keyframe);
			// y is eased output in [0,1]; flip for screen coords.
			pts.push(
				`${(x * PLOT_SIZE).toFixed(2)},${((1 - y) * PLOT_SIZE).toFixed(2)}`,
			);
		}
		return `M ${pts.join(" L ")}`;
	}, [keyframe]);

	// Convert a pointer event into a normalized [0,1] control point.
	const pointFromEvent = useCallback((clientX: number, clientY: number) => {
		const svg = svgRef.current;
		if (!svg) return null;
		const rect = svg.getBoundingClientRect();
		const x = (clientX - rect.left) / rect.width;
		const y = 1 - (clientY - rect.top) / rect.height; // flip y
		return {
			x: Math.max(0, Math.min(1, x)),
			y: Math.max(0, Math.min(1, y)),
		};
	}, []);

	const startDrag = (which: "p1" | "p2") => (event: React.PointerEvent) => {
		event.preventDefault();
		event.stopPropagation();
		(event.target as Element).setPointerCapture(event.pointerId);

		// Ensure we're in bezier mode before dragging handles.
		if (!isCustom) {
			onChange({
				easing: "bezier",
				bezierP1: p1,
				bezierP2: p2,
			});
		}

		const move = (ev: PointerEvent) => {
			const pt = pointFromEvent(ev.clientX, ev.clientY);
			if (!pt) return;
			if (which === "p1") {
				onChange({ easing: "bezier", bezierP1: pt, bezierP2: p2 });
			} else {
				onChange({ easing: "bezier", bezierP1: p1, bezierP2: pt });
			}
		};
		const up = (ev: PointerEvent) => {
			(event.target as Element).releasePointerCapture(event.pointerId);
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
			// Final commit to be safe.
			const pt = pointFromEvent(ev.clientX, ev.clientY);
			if (pt) {
				if (which === "p1") onChange({ easing: "bezier", bezierP1: pt });
				else onChange({ easing: "bezier", bezierP2: pt });
			}
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
	};

	return (
		<div className="flex flex-col gap-3">
			{/* Preset selector */}
			<div className="grid grid-cols-4 gap-1">
				{EASING_PRESET_LIST.map((preset) => (
					<button
						key={preset.id}
						type="button"
						onClick={() =>
							onChange({
								easing: preset.id,
								bezierP1: undefined,
								bezierP2: undefined,
							})
						}
						className={cn(
							"rounded-sm border px-1 py-1 text-[10px] transition-colors",
							keyframe.easing === preset.id
								? "border-primary bg-primary/10 text-primary"
								: "border-border text-muted-foreground hover:bg-accent",
						)}
					>
						{easingLabel(preset.id, t)}
					</button>
				))}
			</div>

			{/* Curve plot */}
			<div className="flex flex-col items-center gap-1.5">
				<svg
					ref={svgRef}
					viewBox={`0 0 ${PLOT_SIZE} ${PLOT_SIZE}`}
					role="img"
					aria-label={t("Easing curve")}
					className="w-40 touch-none rounded-sm border border-border bg-background"
					onPointerDown={(e) => {
						// Clicking empty plot space switches to custom mode.
						if (!isCustom && e.target === svgRef.current) {
							onChange({ easing: "bezier", bezierP1: p1, bezierP2: p2 });
						}
					}}
				>
					{/* Diagonal reference (linear) */}
					<line
						x1={0}
						y1={PLOT_SIZE}
						x2={PLOT_SIZE}
						y2={0}
						stroke="currentColor"
						strokeWidth={0.5}
						className="text-muted-foreground/30"
						strokeDasharray="2 2"
					/>
					{/* The easing curve */}
					<path
						d={pathD}
						fill="none"
						stroke="currentColor"
						strokeWidth={1.5}
						className="text-primary"
					/>
					{/* Control-point guide lines */}
					<line
						x1={0}
						y1={PLOT_SIZE}
						x2={p1.x * PLOT_SIZE}
						y2={(1 - p1.y) * PLOT_SIZE}
						stroke="currentColor"
						strokeWidth={0.75}
						className="text-muted-foreground/50"
					/>
					<line
						x1={PLOT_SIZE}
						y1={0}
						x2={p2.x * PLOT_SIZE}
						y2={(1 - p2.y) * PLOT_SIZE}
						stroke="currentColor"
						strokeWidth={0.75}
						className="text-muted-foreground/50"
					/>
					{/* Handle P1 */}
					{/* biome-ignore lint/a11y/noStaticElementInteractions: SVG circle is a draggable handle; keyboard-accessible via onKeyDown */}
					<circle
						cx={p1.x * PLOT_SIZE}
						cy={(1 - p1.y) * PLOT_SIZE}
						r={HANDLE_RADIUS}
						aria-label={t("Bezier control P1")}
						tabIndex={0}
						className={cn(
							"cursor-grab fill-primary stroke-background",
							isCustom ? "opacity-100" : "opacity-40",
						)}
						strokeWidth={1.5}
						onPointerDown={startDrag("p1")}
						onKeyDown={(e) => {
							if (!isCustom) return;
							const step = e.shiftKey ? 0.1 : 0.01;
							if (e.key === "ArrowLeft")
								onChange({ bezierP1: { ...p1, x: clamp(p1.x - step) } });
							else if (e.key === "ArrowRight")
								onChange({ bezierP1: { ...p1, x: clamp(p1.x + step) } });
							else if (e.key === "ArrowUp")
								onChange({ bezierP1: { ...p1, y: clamp(p1.y + step) } });
							else if (e.key === "ArrowDown")
								onChange({ bezierP1: { ...p1, y: clamp(p1.y - step) } });
						}}
					/>
					{/* Handle P2 */}
					{/* biome-ignore lint/a11y/noStaticElementInteractions: SVG circle is a draggable handle; keyboard-accessible via onKeyDown */}
					<circle
						cx={p2.x * PLOT_SIZE}
						cy={(1 - p2.y) * PLOT_SIZE}
						r={HANDLE_RADIUS}
						aria-label={t("Bezier control P2")}
						tabIndex={0}
						className={cn(
							"cursor-grab fill-primary stroke-background",
							isCustom ? "opacity-100" : "opacity-40",
						)}
						strokeWidth={1.5}
						onPointerDown={startDrag("p2")}
						onKeyDown={(e) => {
							if (!isCustom) return;
							const step = e.shiftKey ? 0.1 : 0.01;
							if (e.key === "ArrowLeft")
								onChange({ bezierP2: { ...p2, x: clamp(p2.x - step) } });
							else if (e.key === "ArrowRight")
								onChange({ bezierP2: { ...p2, x: clamp(p2.x + step) } });
							else if (e.key === "ArrowUp")
								onChange({ bezierP2: { ...p2, y: clamp(p2.y + step) } });
							else if (e.key === "ArrowDown")
								onChange({ bezierP2: { ...p2, y: clamp(p2.y - step) } });
						}}
					/>
				</svg>
				<button
					type="button"
					onClick={() =>
						onChange({
							easing: "bezier",
							bezierP1: { x: 0.33, y: 0 },
							bezierP2: { x: 0.67, y: 1 },
						})
					}
					className={cn(
						"text-[10px] underline-offset-2 hover:underline",
						isCustom ? "text-primary" : "text-muted-foreground",
					)}
				>
					{t("Custom curve")}
				</button>
			</div>
		</div>
	);
}

function clamp(n: number): number {
	return Math.max(0, Math.min(1, n));
}

function easingLabel(id: Exclude<Easing, "bezier">, t: (k: string) => string) {
	switch (id) {
		case "linear":
			return t("Linear");
		case "ease-in":
			return t("Ease in");
		case "ease-out":
			return t("Ease out");
		case "ease-in-out":
			return t("Ease in-out");
	}
}
