import { describe, expect, test } from "bun:test";
import { toAnthropicPayload } from "./anthropic";
import type { OpenAIChatMessage, OpenAIToolSchema } from "./types";

describe("toAnthropicPayload", () => {
	test("extracts system messages into the system field", () => {
		const messages: OpenAIChatMessage[] = [
			{ role: "system", content: "You are an editor." },
			{ role: "user", content: "hi" },
		];
		const payload = toAnthropicPayload({ messages, model: "claude-x" });
		expect(payload.system).toBe("You are an editor.");
		expect(payload.messages).toEqual([
			{ role: "user", content: [{ type: "text", text: "hi" }] },
		]);
		expect(payload.model).toBe("claude-x");
		expect(payload.stream).toBe(true);
		expect(payload.max_tokens).toBeGreaterThan(0);
	});

	test("joins multiple system messages", () => {
		const messages: OpenAIChatMessage[] = [
			{ role: "system", content: "part one" },
			{ role: "system", content: "part two" },
			{ role: "user", content: "hi" },
		];
		const payload = toAnthropicPayload({ messages, model: "claude-x" });
		expect(payload.system).toBe("part one\n\npart two");
	});

	test("converts assistant tool_calls into tool_use blocks", () => {
		const messages: OpenAIChatMessage[] = [
			{ role: "user", content: "cut it" },
			{
				role: "assistant",
				content: null,
				tool_calls: [
					{
						id: "call_1",
						type: "function",
						function: { name: "cut_media", arguments: '{"start":1.5}' },
					},
				],
			},
		];
		const payload = toAnthropicPayload({ messages, model: "claude-x" });
		expect(payload.messages).toHaveLength(2);
		expect(payload.messages[1]).toEqual({
			role: "assistant",
			content: [
				{
					type: "tool_use",
					id: "call_1",
					name: "cut_media",
					input: { start: 1.5 },
				},
			],
		});
	});

	test("merges consecutive tool results into one user message", () => {
		const messages: OpenAIChatMessage[] = [
			{ role: "user", content: "go" },
			{
				role: "assistant",
				content: null,
				tool_calls: [
					{
						id: "call_a",
						type: "function",
						function: { name: "t1", arguments: "{}" },
					},
					{
						id: "call_b",
						type: "function",
						function: { name: "t2", arguments: "{}" },
					},
				],
			},
			{ role: "tool", tool_call_id: "call_a", content: "ok a" },
			{ role: "tool", tool_call_id: "call_b", content: "ok b" },
			{ role: "assistant", content: "done" },
		];
		const payload = toAnthropicPayload({ messages, model: "claude-x" });
		expect(payload.messages).toHaveLength(4);
		expect(payload.messages[2]).toEqual({
			role: "user",
			content: [
				{ type: "tool_result", tool_use_id: "call_a", content: "ok a" },
				{ type: "tool_result", tool_use_id: "call_b", content: "ok b" },
			],
		});
		expect(payload.messages[3]).toEqual({
			role: "assistant",
			content: [{ type: "text", text: "done" }],
		});
	});

	test("keeps roles alternating by merging same-role turns", () => {
		const messages: OpenAIChatMessage[] = [
			{ role: "user", content: "first" },
			{ role: "user", content: "second" },
			{ role: "assistant", content: "answer" },
		];
		const payload = toAnthropicPayload({ messages, model: "claude-x" });
		expect(payload.messages).toHaveLength(2);
		expect(payload.messages[0].role).toBe("user");
		expect(payload.messages[0].content).toEqual([
			{ type: "text", text: "first" },
			{ type: "text", text: "second" },
		]);
	});

	test("drops empty turns instead of sending empty content", () => {
		const messages: OpenAIChatMessage[] = [
			{ role: "user", content: "" },
			{ role: "user", content: "real question" },
		];
		const payload = toAnthropicPayload({ messages, model: "claude-x" });
		expect(payload.messages).toHaveLength(1);
	});

	test("converts OpenAI tool schemas to Anthropic input_schema", () => {
		const tools: OpenAIToolSchema[] = [
			{
				type: "function",
				function: {
					name: "cut_media",
					description: "Cut a clip",
					parameters: {
						type: "object",
						properties: { start: { type: "number" } },
					},
				},
			},
		];
		const payload = toAnthropicPayload({
			messages: [{ role: "user", content: "hi" }],
			tools,
			model: "claude-x",
		});
		expect(payload.tools).toEqual([
			{
				name: "cut_media",
				description: "Cut a clip",
				input_schema: {
					type: "object",
					properties: { start: { type: "number" } },
				},
			},
		]);
	});

	test("omits tools and system when not provided", () => {
		const payload = toAnthropicPayload({
			messages: [{ role: "user", content: "hi" }],
			model: "claude-x",
		});
		expect(payload.tools).toBeUndefined();
		expect(payload.system).toBeUndefined();
	});
});
