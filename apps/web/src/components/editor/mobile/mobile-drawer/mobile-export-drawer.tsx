"use client";

import { useCallback, useRef, useState } from "react";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Download } from "lucide-react";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { getExportFileExtension, getExportMimeType } from "@/lib/export";
import { shareOrDownloadFile } from "@/lib/download";
import {
	isExportFormat,
	isExportQuality,
	type ExportFormat,
	type ExportQuality,
	type ExportResult,
} from "@/types/export";
import { ExportError } from "@/components/editor/export-error";
import { useEditor } from "@/hooks/use-editor";
import { DEFAULT_EXPORT_OPTIONS } from "@/constants/export-constants";
import { useMobileDrawerStore } from "../hooks/use-mobile-drawer";

export function MobileExportDrawer() {
	const { t } = useTranslation();
	const editor = useEditor();
	const { activeDrawer, closeDrawer } = useMobileDrawerStore();
	const isOpen = activeDrawer === "export";
	const activeProject = editor.project.getActive();

	const [format, setFormat] = useState<ExportFormat>(
		DEFAULT_EXPORT_OPTIONS.format,
	);
	const [quality, setQuality] = useState<ExportQuality>(
		DEFAULT_EXPORT_OPTIONS.quality,
	);
	const [includeAudio, setIncludeAudio] = useState<boolean>(
		DEFAULT_EXPORT_OPTIONS.includeAudio || true,
	);
	const [isExporting, setIsExporting] = useState(false);
	const [progress, setProgress] = useState(0);
	const [exportResult, setExportResult] = useState<ExportResult | null>(null);
	const cancelRequestedRef = useRef(false);

	const handleExport = useCallback(
		async (formatOverride?: ExportFormat) => {
			if (!activeProject) return;

			const effectiveFormat = formatOverride ?? format;

			cancelRequestedRef.current = false;
			setIsExporting(true);
			setProgress(0);
			setExportResult(null);

			const result = await editor.project.export({
				options: {
					format: effectiveFormat,
					quality,
					fps: activeProject.settings.fps,
					includeAudio,
					onProgress: ({ progress }) => setProgress(progress),
					onCancel: () => cancelRequestedRef.current,
				},
			});

			setIsExporting(false);

			if (result.cancelled) {
				setExportResult(null);
				setProgress(0);
				return;
			}

			setExportResult(result);

			if (result.success && result.buffer) {
				const mimeType = getExportMimeType({ format: effectiveFormat });
				const extension = getExportFileExtension({ format: effectiveFormat });
				await shareOrDownloadFile({
					blob: new Blob([result.buffer], { type: mimeType }),
					filename: `${activeProject.metadata.name}${extension}`,
				});

				closeDrawer();
				setExportResult(null);
				setProgress(0);
			}
		},
		[activeProject, closeDrawer, editor.project, format, includeAudio, quality],
	);

	const handleCancel = () => {
		cancelRequestedRef.current = true;
	};

	const handleSwitchToWebM = () => {
		setFormat("webm");
		handleExport("webm");
	};

	return (
		<Drawer
			open={isOpen}
			onOpenChange={(open) => {
				if (!open && !isExporting) closeDrawer();
			}}
			shouldScaleBackground={false}
		>
			<DrawerContent className="max-h-[70vh]">
				<DrawerHeader className="flex flex-row items-center justify-between">
					<DrawerTitle>
						{isExporting ? t("Exporting project") : t("Export project")}
					</DrawerTitle>
				</DrawerHeader>

				<div className="overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
					{exportResult && !exportResult.success ? (
						<ExportError
							error={exportResult.error || "Unknown error occurred"}
							code={exportResult.code}
							onRetry={() => handleExport()}
							onSwitchToWebM={
								exportResult.code === "unsupported_codec" && format !== "webm"
									? handleSwitchToWebM
									: undefined
							}
						/>
					) : isExporting ? (
						<div className="space-y-4">
							<div className="flex flex-col gap-2">
								<p className="text-muted-foreground text-center text-sm">
									{Math.round(progress * 100)}%
								</p>
								<Progress value={progress * 100} className="w-full" />
							</div>
							<Button
								variant="outline"
								className="w-full rounded-md"
								onClick={handleCancel}
							>
								{t("Cancel")}
							</Button>
						</div>
					) : (
						<div className="flex flex-col gap-5">
							<section className="flex flex-col gap-2">
								<h4 className="text-muted-foreground text-xs font-medium uppercase">
									{t("Format")}
								</h4>
								<RadioGroup
									value={format}
									onValueChange={(value) => {
										if (isExportFormat(value)) setFormat(value);
									}}
								>
									<div className="flex items-center gap-3 py-1">
										<RadioGroupItem value="mp4" id="mobile-mp4" />
										<Label htmlFor="mobile-mp4">
											{t("MP4 (H.264) - Better compatibility")}
										</Label>
									</div>
									<div className="flex items-center gap-3 py-1">
										<RadioGroupItem value="webm" id="mobile-webm" />
										<Label htmlFor="mobile-webm">
											{t("WebM (VP9) - Smaller file size")}
										</Label>
									</div>
								</RadioGroup>
							</section>

							<section className="flex flex-col gap-2">
								<h4 className="text-muted-foreground text-xs font-medium uppercase">
									{t("Quality")}
								</h4>
								<RadioGroup
									value={quality}
									onValueChange={(value) => {
										if (isExportQuality(value)) setQuality(value);
									}}
								>
									<div className="flex items-center gap-3 py-1">
										<RadioGroupItem value="low" id="mobile-low" />
										<Label htmlFor="mobile-low">
											{t("Low - Smallest file size")}
										</Label>
									</div>
									<div className="flex items-center gap-3 py-1">
										<RadioGroupItem value="medium" id="mobile-medium" />
										<Label htmlFor="mobile-medium">
											{t("Medium - Balanced")}
										</Label>
									</div>
									<div className="flex items-center gap-3 py-1">
										<RadioGroupItem value="high" id="mobile-high" />
										<Label htmlFor="mobile-high">
											{t("High - Recommended")}
										</Label>
									</div>
									<div className="flex items-center gap-3 py-1">
										<RadioGroupItem value="very_high" id="mobile-very-high" />
										<Label htmlFor="mobile-very-high">
											{t("Very High - Largest file size")}
										</Label>
									</div>
								</RadioGroup>
							</section>

							<section className="flex items-center gap-3">
								<Checkbox
									id="mobile-include-audio"
									checked={includeAudio}
									onCheckedChange={(checked) => setIncludeAudio(!!checked)}
								/>
								<Label htmlFor="mobile-include-audio">
									{t("Include audio in export")}
								</Label>
							</section>

							<Button
								onClick={() => handleExport()}
								className="w-full gap-2"
								size="lg"
							>
								<Download className="size-4" />
								{t("Export")}
							</Button>
						</div>
					)}
				</div>
			</DrawerContent>
		</Drawer>
	);
}
