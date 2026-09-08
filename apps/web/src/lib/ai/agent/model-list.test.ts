import { describe, expect, test } from "bun:test";
import {
	type ModelEntry,
	mergeModelList,
	parseModelsResponse,
} from "./model-list";

describe("parseModelsResponse", () => {
	test("parses OpenAI-style data array", () => {
		const json = { data: [{ id: "gpt-5.2" }, { id: "glm-5.3" }] };
		expect(parseModelsResponse(json)).toEqual(["glm-5.3", "gpt-5.2"]);
	});

	test("deduplicates and sorts", () => {
		const json = { data: [{ id: "b" }, { id: "a" }, { id: "b" }] };
		expect(parseModelsResponse(json)).toEqual(["a", "b"]);
	});

	test("tolerates malformed shapes", () => {
		expect(parseModelsResponse(null)).toEqual([]);
		expect(parseModelsResponse({})).toEqual([]);
		expect(parseModelsResponse({ data: "nope" })).toEqual([]);
		expect(parseModelsResponse({ data: [{ noId: true }, { id: "" }] })).toEqual(
			[],
		);
	});
});

describe("mergeModelList", () => {
	test("keeps existing metadata and appends new ids", () => {
		const current: ModelEntry[] = [{ id: "gpt-5.2", contextWindow: 400_000 }];
		const merged = mergeModelList({
			current,
			fetched: ["gpt-5.2", "glm-5.3"],
		});
		expect(merged).toEqual([
			{ id: "glm-5.3" },
			{ id: "gpt-5.2", contextWindow: 400_000 },
		]);
	});

	test("never removes manual entries missing from fetch", () => {
		const current: ModelEntry[] = [{ id: "my-model", contextWindow: 8_000 }];
		const merged = mergeModelList({ current, fetched: ["gpt-5.2"] });
		expect(merged.map((m) => m.id)).toContain("my-model");
	});

	test("empty fetch keeps current list", () => {
		const current: ModelEntry[] = [{ id: "a" }, { id: "b" }];
		expect(mergeModelList({ current, fetched: [] })).toEqual(current);
	});
});
