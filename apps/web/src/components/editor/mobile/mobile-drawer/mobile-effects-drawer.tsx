"use client";

import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { EffectsView } from "../../panels/assets/views/effects";
import { useMobileDrawerStore } from "../hooks/use-mobile-drawer";

export function MobileEffectsDrawer() {
	const { t } = useTranslation();
	const { activeDrawer, closeDrawer } = useMobileDrawerStore();
	const isOpen = activeDrawer === "effects";

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
					<DrawerTitle>{t("Effects")}</DrawerTitle>
				</DrawerHeader>
				<div className="h-[50vh] overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
					<EffectsView />
				</div>
			</DrawerContent>
		</Drawer>
	);
}
