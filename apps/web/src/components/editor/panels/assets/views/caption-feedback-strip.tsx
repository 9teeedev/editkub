"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { Button } from "@/components/ui/button";
import { X, Check } from "lucide-react";
import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import { trackEvent, type CaptionFeedbackCategory } from "@/lib/analytics";

interface CaptionFeedbackStripProps {
	mode: "local" | "remote";
	provider: string;
	onDismiss: () => void;
}

export function CaptionFeedbackStrip({
	mode,
	provider,
	onDismiss,
}: CaptionFeedbackStripProps) {
	const { t } = useTranslation();
	const [submitted, setSubmitted] = useState(false);
	const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
	const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (collapseTimerRef.current) {
				clearTimeout(collapseTimerRef.current);
			}
		};
	}, []);

	const handleSelectCategory = (category: CaptionFeedbackCategory) => {
		trackEvent("caption_feedback", {
			category,
			mode,
			provider,
		});
		setSubmitted(true);

		// Collapse unobtrusively after user sees confirmation
		collapseTimerRef.current = setTimeout(() => {
			onDismiss();
		}, 2200);
	};

	return (
		<>
			<section
				aria-label={t("How did these captions turn out?")}
				className="flex flex-col gap-2 rounded-lg border border-border bg-card/60 p-2.5 text-xs transition-all"
			>
				<div className="flex items-center justify-between gap-2">
					<p className="font-medium text-foreground text-xs">
						{t("How did these captions turn out?")}
					</p>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-5 text-muted-foreground hover:text-foreground"
						onClick={onDismiss}
						aria-label={t("Close")}
					>
						<X className="size-3.5" />
					</Button>
				</div>

				{submitted ? (
					<div className="flex items-center gap-1.5 py-0.5 text-xs text-muted-foreground">
						<Check className="size-3.5 text-green-500" />
						<span>{t("Thanks — this helps improve Editkub.")}</span>
					</div>
				) : (
					<div className="flex flex-col gap-2">
						<div className="flex flex-wrap items-center gap-1.5">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-6 px-2 text-[11px] font-normal"
								onClick={() => handleSelectCategory("good")}
							>
								{t("Good")}
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-6 px-2 text-[11px] font-normal"
								onClick={() => handleSelectCategory("words")}
							>
								{t("Words need work")}
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-6 px-2 text-[11px] font-normal"
								onClick={() => handleSelectCategory("timing")}
							>
								{t("Timing needs work")}
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-6 px-2 text-[11px] font-normal"
								onClick={() => handleSelectCategory("slow")}
							>
								{t("Too slow")}
							</Button>
						</div>

						<div className="flex items-center justify-start">
							<button
								type="button"
								onClick={() => setFeedbackDialogOpen(true)}
								className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
							>
								{t("Tell us more")}
							</button>
						</div>
					</div>
				)}
			</section>

			<FeedbackDialog
				open={feedbackDialogOpen}
				onOpenChange={setFeedbackDialogOpen}
			/>
		</>
	);
}
