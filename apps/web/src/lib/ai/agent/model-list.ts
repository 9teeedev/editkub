import {
	DEFAULT_CONTEXT_WINDOW,
	findModelPreset,
	formatTokens,
} from "./model-presets";

export interface ModelEntry {
	id: string;
	contextWindow?: number;
}

export type ModelFetchStatus = "idle" | "loading" | "error";

/** Select value for the "open the model manager in settings" item. */
export const MANAGE_MODELS_VALUE = "__manage__";

/**
 * Compact context-size tag for a model entry: explicit user override wins,
 * then the built-in preset map, then the user's default context window.
 */
export function findContextTag({
	entry,
	fallback,
}: {
	entry: ModelEntry;
	fallback?: number;
}): string {
	const size =
		entry.contextWindow ??
		findModelPreset({ model: entry.id })?.contextWindow ??
		fallback ??
		DEFAULT_CONTEXT_WINDOW;
	return formatTokens(size);
}

/**
 * Parses an OpenAI-compatible `GET /models` response
 * (`{ data: [{ id: "..." }, ...] }`). Tolerates missing shapes.
 */
export function parseModelsResponse(json: unknown): string[] {
	if (typeof json !== "object" || json === null) return [];
	const data = (json as { data?: unknown }).data;
	if (!Array.isArray(data)) return [];
	const ids = data
		.map((item) =>
			typeof item === "object" && item !== null && "id" in item
				? (item as { id?: unknown }).id
				: null,
		)
		.filter((id): id is string => typeof id === "string" && id.length > 0);
	return [...new Set(ids)].sort();
}

export async function fetchAvailableModels({
	baseUrl,
	apiKey,
	signal,
}: {
	baseUrl: string;
	apiKey: string;
	signal?: AbortSignal;
}): Promise<string[]> {
	const base = (baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
	const response = await fetch(`${base}/models`, {
		headers: { Authorization: `Bearer ${apiKey}` },
		signal,
	});
	if (!response.ok) {
		throw new Error(`API error (${response.status})`);
	}
	return parseModelsResponse(await response.json());
}

/**
 * Merges fetched model ids into the existing list: keeps user-set metadata
 * (context window overrides) for ids that already exist, appends new ids,
 * never deletes manual entries the user added themselves.
 */
export function mergeModelList({
	current,
	fetched,
}: {
	current: ModelEntry[];
	fetched: string[];
}): ModelEntry[] {
	const byId = new Map(current.map((entry) => [entry.id, entry]));
	for (const id of fetched) {
		if (!byId.has(id)) {
			byId.set(id, { id });
		}
	}
	return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}
