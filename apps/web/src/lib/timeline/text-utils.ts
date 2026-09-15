import type { TextElement } from "@/types/timeline";
import { DEFAULT_LINE_HEIGHT } from "@/constants/text-constants";

export function isBottomAlignedSubtitleText({
	element,
}: {
	element: TextElement;
}): boolean {
	const normalizedName = element.name.trim().toLowerCase();
	return normalizedName === "subtitle" || normalizedName.startsWith("caption ");
}

/** Line spacing multiplier for a text element; 1.3 when unset. */
export function resolveLineHeight({
	element,
}: {
	element: TextElement;
}): number {
	return element.lineHeight && element.lineHeight > 0
		? element.lineHeight
		: DEFAULT_LINE_HEIGHT;
}
