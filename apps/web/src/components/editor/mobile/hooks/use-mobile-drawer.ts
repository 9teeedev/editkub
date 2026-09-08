"use client";

import { create } from "zustand";

type MobileDrawerType =
	| "assets"
	| "text"
	| "sticker"
	| "audio"
	| "ai"
	| "captions"
	| "effects"
	| "filters"
	| "transitions"
	| "properties"
	| "export"
	| null;

interface MobileDrawerState {
	activeDrawer: MobileDrawerType;
	openDrawer: ({ drawer }: { drawer: MobileDrawerType }) => void;
	closeDrawer: () => void;
	toggleDrawer: ({ drawer }: { drawer: NonNullable<MobileDrawerType> }) => void;
}

export const useMobileDrawerStore = create<MobileDrawerState>((set, get) => ({
	activeDrawer: null,
	openDrawer: ({ drawer }) => set({ activeDrawer: drawer }),
	closeDrawer: () => set({ activeDrawer: null }),
	toggleDrawer: ({ drawer }) => {
		const current = get().activeDrawer;
		set({ activeDrawer: current === drawer ? null : drawer });
	},
}));
