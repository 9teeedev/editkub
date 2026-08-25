"use client";

import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { useTranslation } from "@i18next-toolkit/nextjs-approuter";
import { TransitionsView } from "../../panels/assets/views/transitions";
import { useMobileDrawerStore } from "../hooks/use-mobile-drawer";

export function MobileTransitionsDrawer() {
	const { t } = useTranslation();
	const { activeDrawer, closeDrawer } = useMobileDrawerStore();
	const isOpen = activeDrawer === "transitions";

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
					<DrawerTitle>{t("Transitions")}</DrawerTitle>
				</DrawerHeader>
				<div className="h-[50vh] overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
					<TransitionsView />
				</div>
			</DrawerContent>
		</Drawer>
	);
}
