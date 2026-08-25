"use client";

import { useEffect, useCallback } from "react";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { Delete02Icon, ScissorIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invokeAction } from "@/lib/actions";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";
import { useEditor } from "@/hooks/use-editor";
import { PropertiesPanel } from "../../panels/properties";
import { useMobileDrawerStore } from "../hooks/use-mobile-drawer";

export function MobilePropertiesDrawer() {
	const { t } = useTranslation();
	const editor = useEditor();
	const { activeDrawer, closeDrawer } = useMobileDrawerStore();
	const { selectedElements } = useElementSelection();
	const isOpen = activeDrawer === "properties";

	// Auto-close when selection is cleared
	useEffect(() => {
		if (selectedElements.length === 0 && isOpen) {
			closeDrawer();
		}
	}, [selectedElements.length, closeDrawer, isOpen]);

	const handleDelete = useCallback(() => {
		if (selectedElements.length === 0) return;
		editor.timeline.deleteElements({ elements: selectedElements });
		editor.selection.clearSelection();
	}, [editor, selectedElements]);

	const handleSplit = useCallback(() => {
		if (selectedElements.length === 0) return;
		invokeAction("split");
		closeDrawer();
	}, [selectedElements, closeDrawer]);

	return (
		<Drawer
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) closeDrawer();
			}}
			shouldScaleBackground={false}
		>
			<DrawerContent className="max-h-[60vh]">
				<DrawerHeader className="flex flex-row items-center justify-between">
					<DrawerTitle>{t("Properties")}</DrawerTitle>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={handleSplit}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") {
									handleSplit();
								}
							}}
						>
							<HugeiconsIcon icon={ScissorIcon} className="size-4" />
							<span>{t("Split")}</span>
						</Button>
						<Button
							variant="destructive"
							size="sm"
							onClick={handleDelete}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") {
									handleDelete();
								}
							}}
						>
							<HugeiconsIcon icon={Delete02Icon} className="size-4" />
							<span>{t("Delete")}</span>
						</Button>
					</div>
				</DrawerHeader>
				<div className="overflow-y-auto px-4 pb-6">
					<PropertiesPanel />
				</div>
			</DrawerContent>
		</Drawer>
	);
}
