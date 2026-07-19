export type FilterCategory = "color" | "mood" | "vintage" | "cinematic" | "grain";

export interface FilterPreset {
  id: string;
  name: string;
  category: FilterCategory;
  /** CSS filter string passed to ctx.filter — see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter */
  cssFilter: string;
  /** Preview overlay color + opacity for the gallery thumbnail */
  previewOverlay?: { color: string; opacity: number };
}

export const FILTER_PRESETS: FilterPreset[] = [
  { id: "none", name: "Original", category: "color", cssFilter: "none" },
  { id: "vintage", name: "Vintage", category: "vintage", cssFilter: "sepia(0.6) saturate(0.8) contrast(0.9)", previewOverlay: { color: "#d4a046", opacity: 0.08 } },
  { id: "warm", name: "Warm", category: "color", cssFilter: "sepia(0.3) saturate(1.3) hue-rotate(-10deg)", previewOverlay: { color: "#ff8833", opacity: 0.06 } },
  { id: "cool", name: "Cool", category: "color", cssFilter: "saturate(1.1) hue-rotate(20deg) brightness(0.95)", previewOverlay: { color: "#4488ff", opacity: 0.06 } },
  { id: "bw", name: "B&W", category: "mood", cssFilter: "grayscale(1) contrast(1.1)" },
  { id: "cinematic", name: "Cinematic", category: "cinematic", cssFilter: "contrast(1.15) saturate(0.7) brightness(0.95)", previewOverlay: { color: "#1a1a2e", opacity: 0.1 } },
  { id: "vivid", name: "Vivid", category: "color", cssFilter: "saturate(1.5) contrast(1.1) brightness(1.05)" },
  { id: "noir", name: "Noir", category: "mood", cssFilter: "grayscale(1) contrast(1.3) brightness(0.85)" },
  { id: "neon", name: "Neon", category: "cinematic", cssFilter: "saturate(2) hue-rotate(45deg) contrast(1.2)", previewOverlay: { color: "#ff00ff", opacity: 0.12 } },
  { id: "film-grain", name: "Film Grain", category: "grain", cssFilter: "contrast(1.05) saturate(0.85) brightness(0.95)", previewOverlay: { color: "#000000", opacity: 0.03 } },
  { id: "fade", name: "Fade", category: "mood", cssFilter: "saturate(0.6) brightness(1.1) contrast(0.85)", previewOverlay: { color: "#ffffff", opacity: 0.08 } },
  { id: "drama", name: "Drama", category: "cinematic", cssFilter: "contrast(1.4) brightness(0.8) saturate(0.5)", previewOverlay: { color: "#000011", opacity: 0.15 } },
];

export const FILTER_CATEGORIES: FilterCategory[] = ["color", "mood", "vintage", "cinematic", "grain"];
export const FILTER_CATEGORY_LABELS: Record<FilterCategory, string> = {
  color: "Color",
  mood: "Mood",
  vintage: "Vintage",
  cinematic: "Cinematic",
  grain: "Grain",
};
