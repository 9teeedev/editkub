"use client";

import { useEffect } from "react";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { useElementSelection } from "@/hooks/timeline/element/use-element-selection";
import { PropertiesPanel } from "../../panels/properties";
import { useMobileDrawerStore } from "../hooks/use-mobile-drawer";

/**
 * Clip tools live in the contextual bottom toolbar (split / delete are there);
 * this drawer only hosts the properties panel itself.
 */
export function MobilePropertiesDrawer() {
	const { t } = useTranslation();
	const { activeDrawer, closeDrawer } = useMobileDrawerStore();
	const { selectedElements } = useElementSelection();
	const isOpen = activeDrawer === "properties";

	// Auto-close when selection is cleared
	useEffect(() => {
		if (selectedElements.length === 0 && isOpen) {
			closeDrawer();
		}
	}, [selectedElements.length, closeDrawer, isOpen]);

	return (
		<Drawer
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) closeDrawer();
			}}
			shouldScaleBackground={false}
		>
			<DrawerContent className="max-h-[60vh]">
				<DrawerHeader>
					<DrawerTitle>{t("Properties")}</DrawerTitle>
				</DrawerHeader>
				<div className="overflow-y-auto px-4 pb-6">
					<PropertiesPanel />
				</div>
			</DrawerContent>
		</Drawer>
	);
}
