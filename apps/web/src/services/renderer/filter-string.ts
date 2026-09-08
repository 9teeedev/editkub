import type { AdjustmentControls, ElementFilter } from "@/types/timeline";
import { FILTER_PRESETS } from "@/constants/filter-constants";

// Extracted from scene-builder so both per-clip nodes and adjustment layers
// share one filter-string implementation.

export function computeFilterString(
	filter: ElementFilter | undefined,
	adjustments?: AdjustmentControls,
): string {
	// ---- Preset filter ----
	let presetFilter: string;
	if (!filter || filter.presetId === "none" || filter.intensity <= 0) {
		presetFilter = "none";
	} else {
		const preset = FILTER_PRESETS.find((p) => p.id === filter.presetId);
		if (!preset) {
			presetFilter = "none";
		} else if (filter.intensity >= 1) {
			presetFilter = preset.cssFilter;
		} else {
			const round = (n: number) => Math.round(n * 1000) / 1000;
			presetFilter = preset.cssFilter.replace(
				/(\w+)\(([^)]+)\)/g,
				(_match, func: string, value: string) => {
					const hasDeg = value.includes("deg");
					const num = parseFloat(value);
					if (isNaN(num)) return _match;

					let scaled: number;
					if (hasDeg) {
						// hue-rotate: neutral at 0
						scaled = round(num * filter.intensity);
					} else if (func === "sepia" || func === "grayscale") {
						// amount-based: neutral at 0
						scaled = round(num * filter.intensity);
					} else if (func === "blur") {
						// blur radius: neutral at 0
						scaled = round(num * filter.intensity);
					} else {
						// saturate, contrast, brightness — neutral at 1
						scaled = round(1 + (num - 1) * filter.intensity);
					}

					return `${func}(${scaled}${hasDeg ? "deg" : ""})`;
				},
			);
		}
	}

	// ---- Adjustment controls ----
	if (!adjustments) return presetFilter;

	const isDefault =
		adjustments.brightness === 1 &&
		adjustments.contrast === 1 &&
		adjustments.saturation === 1 &&
		adjustments.temperature === 0 &&
		adjustments.tint === 0 &&
		adjustments.hue === 0 &&
		(adjustments.vignette ?? 0) === 0 &&
		(adjustments.sharpen ?? 0) === 0;

	if (isDefault) return presetFilter;

	const round = (n: number) => Math.round(n * 1000) / 1000;
	const parts: string[] = [];

	parts.push(`brightness(${round(adjustments.brightness)})`);
	parts.push(`contrast(${round(adjustments.contrast)})`);
	parts.push(`saturate(${round(adjustments.saturation)})`);

	// Combined hue-rotate for temperature + tint + hue
	const temp = adjustments.temperature;
	const tempHue = temp <= 0 ? -temp * 0.3 : -temp * 0.15;
	const tintHue = adjustments.tint * 0.5;
	const totalHue = tempHue + tintHue + adjustments.hue;
	if (Math.abs(totalHue) > 0.01) {
		parts.push(`hue-rotate(${round(totalHue)}deg)`);
	}

	// Tint adds sepia based on magnitude
	const sepiaAmount = Math.abs(adjustments.tint) / 100;
	if (sepiaAmount > 0.01) {
		parts.push(`sepia(${round(sepiaAmount)})`);
	}

	// Sharpen: 3×3 unsharp convolution via SVG filter (cached, injected into DOM once).
	// Browsers without ctx.filter url() support silently skip it (no crash).
	const sharpenLevel = Math.round(adjustments.sharpen ?? 0);
	if (sharpenLevel > 0) {
		parts.push(`url(#${getSharpenFilterId(sharpenLevel)})`);
	}

	const adjFilter = parts.join(" ");

	if (presetFilter === "none") return adjFilter;
	return `${presetFilter} ${adjFilter}`;
}

// ---- Sharpen filter cache ----
// sharpen is a 3×3 unsharp convolution implemented as an SVG filter element
// injected into <body> once per level. ctx.filter accepts url(#id) on Chromium/Firefox/Safari.
// Levels are bounded 1-100 so cache size is capped.
const sharpenCache = new Map<number, string>();

function getSharpenFilterId(level: number): string {
	const cached = sharpenCache.get(level);
	if (cached) return cached;

	const id = `cutia-sharpen-${level}`;
	if (typeof document !== "undefined" && !document.getElementById(id)) {
		// kernelWeight: 0 at level 1 → 1 at level 100. Center stays at 1, neighbors subtract.
		const w = level / 100; // 0..1
		const center = 1 + 8 * w;
		const side = -w;
		const k = `${side} ${side} ${side} ${side} ${center} ${side} ${side} ${side} ${side}`;
		const ns = "http://www.w3.org/2000/svg";
		const svg = document.createElementNS(ns, "svg");
		svg.setAttribute("width", "0");
		svg.setAttribute("height", "0");
		svg.style.position = "absolute";
		svg.style.pointerEvents = "none";
		const filter = document.createElementNS(ns, "filter");
		filter.setAttribute("id", id);
		filter.setAttribute("color-interpolation-filters", "sRGB");
		const matrix = document.createElementNS(ns, "feConvolveMatrix");
		matrix.setAttribute("order", "3");
		matrix.setAttribute("kernelMatrix", k);
		matrix.setAttribute("preserveAlpha", "true");
		filter.appendChild(matrix);
		svg.appendChild(filter);
		document.body.appendChild(svg);
	}
	sharpenCache.set(level, id);
	return id;
}
