/**
 * UI state for the preview zoom level.
 * "Fit" is represented as null — the canvas is letterboxed to the container.
 * A number is an explicit zoom factor (0.25, 0.5, 1, 2, ...).
 * For core logic, use EditorCore instead.
 */

import { create } from "zustand";

export type PreviewZoom = number; // 1 = 100%
export const PREVIEW_ZOOM_LEVELS: readonly PreviewZoom[] = [
	0.25, 0.5, 0.75, 1, 1.5, 2,
];

interface PreviewZoomStore {
	/** null = Fit (auto letterbox to container) */
	zoom: PreviewZoom | null;
	setZoom: (zoom: PreviewZoom | null) => void;
}

export const usePreviewZoomStore = create<PreviewZoomStore>((set) => ({
	zoom: null,
	setZoom: (zoom) => set({ zoom }),
}));
