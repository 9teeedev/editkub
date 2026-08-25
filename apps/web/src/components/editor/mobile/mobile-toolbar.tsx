"use client";

import {
	AiBrain01Icon,
	ArrowLeft01Icon,
	Delete02Icon,
	Folder03Icon,
	Happy01Icon,
	HeadphonesIcon,
	PencilEdit01Icon,
	ScissorIcon,
	TextIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { cn } from "@/utils/ui";
import { useMobileDrawerStore } from "./hooks/use-mobile-drawer";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";
import { useEditor } from "@/hooks/use-editor";
import { invokeAction } from "@/lib/actions";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";

type TabKey = "assets" | "text" | "sticker" | "audio" | "ai";

interface TabConfig {
	key: TabKey;
	icon: IconSvgElement;
	labelKey: string;
}

const TABS: TabConfig[] = [
	{ key: "assets", icon: Folder03Icon, labelKey: "Assets" },
	{ key: "text", icon: TextIcon, labelKey: "Text" },
	{ key: "sticker", icon: Happy01Icon, labelKey: "Stickers" },
	{ key: "audio", icon: HeadphonesIcon, labelKey: "Audio" },
	{ key: "ai", icon: AiBrain01Icon, labelKey: "AI" },
];

export function MobileToolbar() {
	const { t } = useTranslation();
	const { selectedElements, clearElementSelection } = useElementSelection();

	if (selectedElements.length > 0) {
		return (
			<ClipToolbar
				selectedElements={selectedElements}
				onBack={clearElementSelection}
			/>
		);
	}

	return <TabBar labels={t} />;
}

function TabBar({ labels }: { labels: (key: string) => string }) {
	const activeDrawer = useMobileDrawerStore((s) => s.activeDrawer);
	const toggleDrawer = useMobileDrawerStore((s) => s.toggleDrawer);

	return (
		<nav className="bg-background flex items-center justify-around border-t px-1 pb-[calc(0.375rem+env(safe-area-inset-bottom))] pt-1.5">
			{TABS.map((tab) => {
				const isActive = activeDrawer === tab.key;

				const handlePress = () => {
					toggleDrawer({ drawer: tab.key });
				};

				return (
					<button
						key={tab.key}
						type="button"
						className={cn(
							"flex flex-col items-center gap-0.5 rounded-md px-3 py-1 text-xs transition-colors",
							isActive ? "text-primary" : "text-muted-foreground",
						)}
						onClick={handlePress}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault();
								handlePress();
							}
						}}
						aria-label={labels(tab.labelKey)}
						aria-pressed={isActive}
					>
						<HugeiconsIcon icon={tab.icon} className="size-5" />
						<span>{labels(tab.labelKey)}</span>
					</button>
				);
			})}
		</nav>
	);
}

/**
 * CapCut-style contextual toolbar: selecting a clip swaps the bottom bar
 * to clip tools (back / split / delete / edit) in one tap.
 */
function ClipToolbar({
	selectedElements,
	onBack,
}: {
	selectedElements: { trackId: string; elementId: string }[];
	onBack: () => void;
}) {
	const { t } = useTranslation();
	const editor = useEditor();
	const openDrawer = useMobileDrawerStore((s) => s.openDrawer);

	const handleSplit = () => {
		invokeAction("split");
	};

	const handleDelete = () => {
		editor.timeline.deleteElements({ elements: selectedElements });
		editor.selection.clearSelection();
	};

	const handleEdit = () => {
		openDrawer({ drawer: "properties" });
	};

	return (
		<nav
			className="bg-background flex items-center justify-around border-t px-1 pb-[calc(0.375rem+env(safe-area-inset-bottom))] pt-1.5"
			aria-label={t("Edit")}
		>
			<button
				type="button"
				className="flex flex-col items-center gap-0.5 rounded-md px-3 py-1 text-xs text-muted-foreground transition-colors"
				onClick={onBack}
				onKeyDown={(event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						onBack();
					}
				}}
				aria-label={t("Back")}
			>
				<HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" />
				<span>{t("Back")}</span>
			</button>

			<ToolbarTool
				icon={ScissorIcon}
				label={t("Split")}
				onClick={handleSplit}
			/>
			<ToolbarTool
				icon={Delete02Icon}
				label={t("Delete")}
				onClick={handleDelete}
			/>
			<ToolbarTool
				icon={PencilEdit01Icon}
				label={t("Edit")}
				onClick={handleEdit}
			/>
		</nav>
	);
}

function ToolbarTool({
	icon,
	label,
	onClick,
}: {
	icon: IconSvgElement;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			className="flex flex-col items-center gap-0.5 rounded-md px-3 py-1 text-xs text-foreground transition-colors active:text-primary"
			onClick={onClick}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					onClick();
				}
			}}
			aria-label={label}
		>
			<HugeiconsIcon icon={icon} className="size-5" />
			<span>{label}</span>
		</button>
	);
}
