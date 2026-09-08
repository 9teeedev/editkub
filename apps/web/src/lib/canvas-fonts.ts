/**
 * next/font self-hosts Google fonts under generated family names exposed
 * via CSS variables (e.g. --font-kanit → `'__Kanit_xxx', '__Kanit_Fallback_xxx'`).
 * Canvas `context.font` cannot resolve `var(--font-kanit)`, but it accepts
 * the raw family list — so resolve it from computed styles once and cache.
 */
const CSS_VAR_BY_FAMILY: Record<string, string> = {
	Kanit: "--font-kanit",
	Inter: "--font-inter",
};

const resolvedCache = new Map<string, string>();

/** CSS-resolvable family (list) for canvas font strings. */
export function canvasFontFamily(family: string): string {
	const cssVar = CSS_VAR_BY_FAMILY[family];
	if (!cssVar || typeof window === "undefined") return family;

	const cached = resolvedCache.get(family);
	if (cached) return cached;

	let resolved = family;
	try {
		const value = getComputedStyle(document.documentElement)
			.getPropertyValue(cssVar)
			.trim();
		if (value) resolved = value;
	} catch {
		// computed style unavailable — fall back to the plain family name
	}
	resolvedCache.set(family, resolved);
	return resolved;
}

const loadedFamilies = new Set<string>();

/**
 * Trigger the actual font file download (next/font files load lazily and
 * canvas usage alone does not trigger them). Safe to call repeatedly.
 */
export async function ensureCanvasFontLoaded(family: string): Promise<void> {
	if (typeof document === "undefined" || !document.fonts) return;
	const resolved = canvasFontFamily(family);
	if (loadedFamilies.has(resolved)) return;
	loadedFamilies.add(resolved);
	try {
		await Promise.all([
			document.fonts.load(`400 96px ${resolved}`),
			document.fonts.load(`700 96px ${resolved}`),
		]);
	} catch {
		// font unavailable — canvas keeps the fallback metrics
	}
}
