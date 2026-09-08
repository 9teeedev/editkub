"use client";

import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { Captions } from "../../panels/assets/views/captions";
import { useMobileDrawerStore } from "../hooks/use-mobile-drawer";

export function MobileCaptionsDrawer() {
	const { t } = useTranslation();
	const { activeDrawer, closeDrawer } = useMobileDrawerStore();
	const isOpen = activeDrawer === "captions";

	return (
		<Drawer
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) closeDrawer();
			}}
			shouldScaleBackground={false}
		>
			<DrawerContent className="max-h-[75vh]">
				<DrawerHeader>
					<DrawerTitle>{t("Captions")}</DrawerTitle>
				</DrawerHeader>
				{/* Captions manages its own sub-tabs with h-full layouts, so give
				    the body a fixed height instead of max-h + auto scroll. */}
				<div className="h-[60vh] overflow-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
					<Captions />
				</div>
			</DrawerContent>
		</Drawer>
	);
}
