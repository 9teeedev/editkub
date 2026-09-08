"use client";

import { useState } from "react";
import { useRouter } from "@/lib/navigation";
import { useEditor } from "@/hooks/use-editor";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SiBuymeacoffee } from "react-icons/si";
import { recordSupportClick } from "@/lib/donation";
import {
	ArrowLeft02Icon,
	ArrowTurnBackwardIcon,
	ArrowTurnForwardIcon,
	BubbleChatIcon,
	FullScreenIcon,
	MoreVerticalIcon,
	Settings01Icon,
	TransitionTopIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import { AnnouncementBell } from "../announcement-bell";
import { useMobileDrawerStore } from "./hooks/use-mobile-drawer";

export function MobileHeader() {
	const { t } = useTranslation();
	const router = useRouter();
	const editor = useEditor();
	const [isExiting, setIsExiting] = useState(false);

	const activeProject = editor.project.getActive();
	const projectName = activeProject?.metadata.name ?? "";
	const canUndo = editor.command.canUndo();
	const canRedo = editor.command.canRedo();
	const openDrawer = useMobileDrawerStore((s) => s.openDrawer);

	const handleBack = async () => {
		if (isExiting) return;
		setIsExiting(true);

		try {
			await editor.project.prepareExit();
		} finally {
			editor.project.closeProject();
			router.push("/projects");
		}
	};

	const handleUndo = () => {
		editor.command.undo();
	};

	const handleRedo = () => {
		editor.command.redo();
	};

	const handleExport = () => {
		openDrawer({ drawer: "export" });
	};

	const handleFullscreenPreview = () => {
		const previewEl = document.querySelector("[data-preview-container]");
		if (previewEl instanceof HTMLElement) {
			previewEl.requestFullscreen();
		}
	};

	return (
		<header className="bg-background flex h-11 items-center justify-between border-b px-2 pt-[env(safe-area-inset-top)]">
			<div className="flex items-center gap-1 min-w-0">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-8 shrink-0"
					onClick={handleBack}
					onKeyDown={(event) => {
						if (event.key === "Enter" || event.key === " ") {
							event.preventDefault();
							handleBack();
						}
					}}
					disabled={isExiting}
					title={t("Back to projects")}
				>
					<HugeiconsIcon icon={ArrowLeft02Icon} className="size-4" />
				</Button>

				<span className="max-w-[140px] truncate text-sm font-medium">
					{projectName}
				</span>
			</div>

			<div className="flex items-center gap-1">
				<AnnouncementBell />

				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-8"
					onClick={handleUndo}
					onKeyDown={(event) => {
						if (event.key === "Enter" || event.key === " ") {
							event.preventDefault();
							handleUndo();
						}
					}}
					disabled={!canUndo}
					title={t("Undo")}
				>
					<HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-4" />
				</Button>

				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-8"
					onClick={handleRedo}
					onKeyDown={(event) => {
						if (event.key === "Enter" || event.key === " ") {
							event.preventDefault();
							handleRedo();
						}
					}}
					disabled={!canRedo}
					title={t("Redo")}
				>
					<HugeiconsIcon icon={ArrowTurnForwardIcon} className="size-4" />
				</Button>

				<Button
					type="button"
					size="sm"
					className="h-8 gap-1.5 px-3 font-semibold"
					onClick={handleExport}
					onKeyDown={(event) => {
						if (event.key === "Enter" || event.key === " ") {
							event.preventDefault();
							handleExport();
						}
					}}
					disabled={!activeProject}
					title={t("Export")}
				>
					<HugeiconsIcon icon={TransitionTopIcon} className="size-4" />
					<span>{t("Export")}</span>
				</Button>

				<OverflowMenu onFullscreenPreview={handleFullscreenPreview} />
			</div>
		</header>
	);
}

function OverflowMenu({
	onFullscreenPreview,
}: {
	onFullscreenPreview: () => void;
}) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const [feedbackOpen, setFeedbackOpen] = useState(false);

	const handleSelect = ({ action }: { action: () => void }) => {
		setOpen(false);
		action();
	};

	const handleFeedback = () => {
		setOpen(false);
		setTimeout(() => setFeedbackOpen(true), 0);
	};

	return (
		<>
			<DropdownMenu open={open} onOpenChange={setOpen}>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-8"
						title={t("More options")}
					>
						<HugeiconsIcon icon={MoreVerticalIcon} className="size-4" />
					</Button>
				</DropdownMenuTrigger>

				<DropdownMenuContent align="end" className="w-48">
					<DropdownMenuItem
						className="flex items-center gap-2"
						onClick={() =>
							handleSelect({
								action: () => {
									/* Project settings will be handled by a drawer */
								},
							})
						}
					>
						<HugeiconsIcon icon={Settings01Icon} className="size-4" />
						{t("Project settings")}
					</DropdownMenuItem>

					<DropdownMenuItem
						className="flex items-center gap-2"
						onClick={() =>
							handleSelect({
								action: onFullscreenPreview,
							})
						}
					>
						<HugeiconsIcon icon={FullScreenIcon} className="size-4" />
						{t("Fullscreen preview")}
					</DropdownMenuItem>

					<DropdownMenuItem
						className="flex items-center gap-2"
						onClick={handleFeedback}
					>
						<HugeiconsIcon icon={BubbleChatIcon} className="size-4" />
						{t("Feedback")}
					</DropdownMenuItem>

					<DropdownMenuSeparator />

					<DropdownMenuItem
						className="flex items-center gap-2"
						onClick={() =>
							handleSelect({
								action: () => {
									recordSupportClick({
										surface: "mobile",
										placement: "editor_menu",
									});
								},
							})
						}
					>
						<SiBuymeacoffee className="size-4" />
						{t("Support Editkub")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
		</>
	);
}
