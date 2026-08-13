"use client";

import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { LeftToRightBlockQuoteIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

/**
 * Subtitles tab — placeholder.
 *
 * Unlike Captions (which transcribe all audio incl. sound effects for the
 * deaf/hard-of-hearing), Subtitles are translated dialogue text for viewers
 * who don't speak the source language. The full subtitle authoring flow is
 * not yet implemented in editkub-public; this view reserves the tab slot.
 */
export function SubtitlesView() {
	const { t } = useTranslation();

	return (
		<div className="flex h-full flex-col">
			<div className="border-b px-4 pt-3 pb-2">
				<h3 className="mb-2 text-sm font-medium">{t("Subtitles")}</h3>
				<p className="text-muted-foreground text-xs">
					{t("Translated dialogue text for viewers.")}
				</p>
			</div>
			<div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
				<HugeiconsIcon
					icon={LeftToRightBlockQuoteIcon}
					className="text-muted-foreground/50 size-10"
				/>
				<div className="space-y-1">
					<p className="text-muted-foreground text-sm font-medium">
						{t("Coming soon")}
					</p>
					<p className="text-muted-foreground/70 text-xs">
						{t("Subtitle generation and editing are on the roadmap.")}
					</p>
				</div>
			</div>
		</div>
	);
}
