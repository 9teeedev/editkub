"use client";

import { useEffect, useRef } from "react";
import { MobileHeader } from "./mobile-header";
import { MobilePreview } from "./mobile-preview";
import { MobileTimeline } from "./mobile-timeline/mobile-timeline";
import { MobileToolbar } from "./mobile-toolbar";
import { MobileAssetsDrawer } from "./mobile-drawer/mobile-assets-drawer";
import { MobilePropertiesDrawer } from "./mobile-drawer/mobile-properties-drawer";
import { MobileTextDrawer } from "./mobile-drawer/mobile-text-drawer";
import { MobileStickerDrawer } from "./mobile-drawer/mobile-sticker-drawer";
import { MobileAudioDrawer } from "./mobile-drawer/mobile-audio-drawer";
import { MobileAIDrawer } from "./mobile-drawer/mobile-ai-drawer";
import { MobileExportDrawer } from "./mobile-drawer/mobile-export-drawer";
import { useCloseDrawerOnInsert } from "./hooks/use-close-drawer-on-insert";

export function MobileEditorLayout() {
	useCloseDrawerOnInsert();

	const rootRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const el = rootRef.current;
		if (!el) return;
		const prevent = (e: Event) => e.preventDefault();
		el.addEventListener("contextmenu", prevent);
		return () => el.removeEventListener("contextmenu", prevent);
	}, []);

	return (
		<div ref={rootRef} className="flex h-full flex-col">
			<MobileHeader />
			<MobilePreview />
			<MobileTimeline />
			<MobileToolbar />

			{/* Drawer layer */}
			<MobileAssetsDrawer />
			<MobilePropertiesDrawer />
			<MobileTextDrawer />
			<MobileStickerDrawer />
			<MobileAudioDrawer />
			<MobileAIDrawer />
			<MobileExportDrawer />
		</div>
	);
}
