import { create } from "zustand";

interface CropState {
	/** Element currently in canvas crop-adjust mode, or null. */
	elementId: string | null;
	setCropping: (elementId: string | null) => void;
}

export const useCropStore = create<CropState>((set) => ({
	elementId: null,
	setCropping: (elementId) => set({ elementId }),
}));
