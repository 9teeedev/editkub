"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy, Download, RotateCcw } from "lucide-react";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import type { ExportErrorCode } from "@/types/export";

/** Shared export-failure block used by the desktop popover and the mobile drawer. */
export function ExportError({
	error,
	code,
	onRetry,
	onSwitchToWebM,
}: {
	error: string;
	code?: ExportErrorCode;
	onRetry: () => void;
	onSwitchToWebM?: () => void;
}) {
	const { t } = useTranslation();
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(error);
		setCopied(true);
		setTimeout(() => setCopied(false), 1000);
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-1.5">
				<p className="text-destructive text-sm font-medium">
					{t("Export failed")}
				</p>
				<p className="text-muted-foreground text-xs">{error}</p>
			</div>

			{onSwitchToWebM && (
				<Button onClick={onSwitchToWebM} className="w-full gap-2">
					<Download className="size-4" />
					{t("Use WebM instead")}
				</Button>
			)}

			<div className="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					className="h-8 flex-1 text-xs"
					onClick={handleCopy}
				>
					{copied ? <Check className="text-constructive" /> : <Copy />}
					{t("Copy")}
				</Button>
				<Button
					variant="outline"
					size="sm"
					className="h-8 flex-1 text-xs"
					onClick={onRetry}
				>
					<RotateCcw />
					{t("Retry")}
				</Button>
			</div>
		</div>
	);
}
