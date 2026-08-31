import type { CaptionTemplate } from "@/types/transcript";

/**
 * Caption flow templates: how the actively-spoken word is highlighted.
 * Base text styling (font, size, position) comes from
 * `createSubtitleFromTemplate` in subtitle-constants; these presets only
 * pick the highlight behavior and its accent color.
 */
export const CAPTION_FLOW_TEMPLATES: CaptionTemplate[] = [
	{
		templateId: "flow-focus-color",
		templateName: "Focus Color",
		flow: "color",
		accentColor: "#f97316",
	},
	{
		templateId: "flow-box",
		templateName: "Box Outline",
		flow: "box",
		accentColor: "#fbbf24",
	},
	{
		templateId: "flow-block",
		templateName: "Block Highlight",
		flow: "block",
		accentColor: "#f97316",
	},
	{
		templateId: "flow-karaoke-fill",
		templateName: "Karaoke Fill",
		flow: "fill",
		accentColor: "#22d3ee",
	},
	{
		templateId: "flow-pop",
		templateName: "Pop",
		flow: "pop",
		accentColor: "#f43f5e",
	},
];

export const DEFAULT_CAPTION_TEMPLATE_ID = CAPTION_FLOW_TEMPLATES[0].templateId;

/** Pop captions reveal words only after their own timestamp starts. */
export function isCaptionWordVisible({
	flow,
	localTime,
	start,
}: {
	flow: CaptionTemplate["flow"];
	localTime: number;
	start: number;
}) {
	return flow !== "pop" || localTime >= start;
}

/** Frame values shared by canvas caption-flow animations. */
export function resolveCaptionFlowFrame({
	elapsed,
	duration,
}: {
	elapsed: number;
	duration: number;
}) {
	const safeDuration = Math.max(duration, 0.001);
	const clampedElapsed = Math.min(safeDuration, Math.max(0, elapsed));
	const progress = clampedElapsed / safeDuration;
	const entranceDuration = Math.min(0.18, Math.max(0.08, safeDuration * 0.35));
	const entranceProgress = Math.min(1, clampedElapsed / entranceDuration);
	const entrance = 1 - (1 - entranceProgress) ** 3;
	const popDuration = Math.min(0.32, Math.max(0.16, safeDuration * 0.5));
	const popProgress = Math.min(1, clampedElapsed / popDuration);
	const popScale =
		popProgress >= 1
			? 1
			: popProgress < 0.55
				? 0.65 +
					(1.16 - 0.65) * (1 - (1 - popProgress / 0.55) ** 3)
				: 1.16 +
					(1 - 1.16) * (1 - (1 - (popProgress - 0.55) / 0.45) ** 3);

	return {
		progress,
		entrance,
		popScale,
	};
}

export function getCaptionTemplate(templateId: string): CaptionTemplate {
	return (
		CAPTION_FLOW_TEMPLATES.find((t) => t.templateId === templateId) ??
		CAPTION_FLOW_TEMPLATES[0]
	);
}
