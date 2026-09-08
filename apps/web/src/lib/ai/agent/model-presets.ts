export interface ModelPreset {
	id: string;
	label: string;
	contextWindow: number;
}

export const DEFAULT_CONTEXT_WINDOW = 128_000;

/**
 * Common models on OpenAI-compatible endpoints with their approximate
 * context windows. Used by the context indicator in the agent footer.
 * Matched by prefix so variants (e.g. "gpt-5.2-mini") resolve too.
 */
export const MODEL_PRESETS: ModelPreset[] = [
	{ id: "gpt-5.2", label: "GPT-5.2", contextWindow: 400_000 },
	{ id: "gpt-5.1", label: "GPT-5.1", contextWindow: 400_000 },
	{ id: "gpt-4.1", label: "GPT-4.1", contextWindow: 1_000_000 },
	{ id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", contextWindow: 1_000_000 },
	{
		id: "gemini-2.5-flash",
		label: "Gemini 2.5 Flash",
		contextWindow: 1_000_000,
	},
	{
		id: "claude-sonnet-4-5",
		label: "Claude Sonnet 4.5",
		contextWindow: 200_000,
	},
	{ id: "claude-opus-4-1", label: "Claude Opus 4.1", contextWindow: 200_000 },
	{ id: "glm-5.3", label: "GLM-5.3", contextWindow: 350_000 },
	{ id: "deepseek-v3-2", label: "DeepSeek V3.2", contextWindow: 128_000 },
];

export function findModelPreset({
	model,
}: {
	model: string;
}): ModelPreset | null {
	const normalized = model.trim().toLowerCase();
	if (!normalized) return null;
	return (
		MODEL_PRESETS.find(
			(preset) =>
				normalized === preset.id || normalized.startsWith(`${preset.id}-`),
		) ?? null
	);
}

export function getContextWindow({
	model,
	fallback = DEFAULT_CONTEXT_WINDOW,
}: {
	model: string;
	fallback?: number;
}): number {
	const preset = findModelPreset({ model });
	if (preset) return preset.contextWindow;
	return fallback > 0 ? fallback : DEFAULT_CONTEXT_WINDOW;
}

export function formatTokens(tokens: number): string {
	if (!Number.isFinite(tokens) || tokens <= 0) return "0";
	if (tokens >= 1_000_000) {
		const value = tokens / 1_000_000;
		return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10}M`;
	}
	if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
	return `${Math.round(tokens)}`;
}
