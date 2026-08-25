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

export function getCaptionTemplate(templateId: string): CaptionTemplate {
	return (
		CAPTION_FLOW_TEMPLATES.find((t) => t.templateId === templateId) ??
		CAPTION_FLOW_TEMPLATES[0]
	);
}
