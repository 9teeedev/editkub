import { create } from "zustand";

interface ChromaPickerState {
	isPicking: boolean;
	setPicking: (isPicking: boolean) => void;
}

export const useChromaPickerStore = create<ChromaPickerState>((set) => ({
	isPicking: false,
	setPicking: (isPicking) => set({ isPicking }),
}));
