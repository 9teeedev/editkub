import type { CreateTextElement } from "@/types/timeline";
import type { TranscriptData } from "@/types/transcript";
import { getCaptionTemplate } from "@/constants/caption-templates";
import { getTextScaleFactor } from "@/constants/text-constants";
import {
	buildCaptionGroups,
	joinWordTexts,
	MIN_CAPTION_ELEMENT_DURATION,
	type CaptionGroup,
} from "./group-words";

/**
 * Base text look for derived caption elements: tamsub-style large bold
 * white text with a thick black outline, no background box. The outline
 * gives contrast over any footage while karaoke highlighting reads
 * clearly. Users can restyle a selected caption via the text properties
 * panel afterwards.
 */
const CAPTION_BASE_STYLE = {
	fontSize: 12,
	fontFamily: "Kanit",
	color: "#ffffff",
	backgroundColor: "transparent",
	textAlign: "center" as const,
	fontWeight: "bold" as const,
	fontStyle: "normal" as const,
	textDecoration: "none" as const,
	opacity: 1,
	stroke: { color: "#000000", width: 10 },
};

/**
 * Wrap width (fraction of canvas width) shared by the renderer's caption
 * path and the derived `boxWidth`, so the element's selection box matches
 * what is actually drawn.
 */
export const CAPTION_WRAP_FRACTION = 0.8;

/** Caption groups derived from a transcript's current settings. */
export function getTranscriptCaptionGroups({
	transcript,
}: {
	transcript: TranscriptData;
}): CaptionGroup[] {
	return buildCaptionGroups({
		segments: transcript.segments,
		wordsPerGroup: transcript.wordsPerGroup,
	});
}

/**
 * Derive timeline caption elements from the transcript. Timing values are
 * absolute on the timeline; `wordTimings` are converted to element-local
 * seconds so the renderer can highlight the spoken word directly.
 * `boxWidth` mirrors the renderer's wrap width so selection bounds hug
 * the drawn text.
 */
export function deriveCaptionElements({
	transcript,
	canvasWidth = 1920,
	canvasHeight = 1080,
}: {
	transcript: TranscriptData;
	canvasWidth?: number;
	canvasHeight?: number;
}): CreateTextElement[] {
	const template = getCaptionTemplate(transcript.templateId);
	const groups = getTranscriptCaptionGroups({ transcript });
	const scaleFactor = getTextScaleFactor({ canvasWidth, canvasHeight });
	const boxWidth = Math.round(
		(canvasWidth * CAPTION_WRAP_FRACTION) / scaleFactor,
	);
	// Lower-third placement, proportional so it holds for any canvas size.
	const positionY = Math.round(canvasHeight * 0.35);

	return groups.map((group, index) => {
		const duration = Math.max(
			MIN_CAPTION_ELEMENT_DURATION,
			group.end - group.start,
		);
		return {
			...CAPTION_BASE_STYLE,
			type: "text" as const,
			name: `Caption ${index + 1}`,
			transform: {
				scale: 1,
				position: { x: 0, y: positionY },
				rotate: 0,
			},
			content: joinWordTexts(group.words.map((w) => w.text)),
			startTime: group.start,
			duration,
			trimStart: 0,
			trimEnd: 0,
			boxWidth,
			wordTimings: group.words.map((word) => ({
				text: word.text,
				start: Math.max(0, word.start - group.start),
				end: Math.min(duration, Math.max(word.end - group.start, 0.05)),
			})),
			captionStyle: {
				flow: template.flow,
				accentColor: transcript.accentColor || template.accentColor,
			},
		};
	});
}
