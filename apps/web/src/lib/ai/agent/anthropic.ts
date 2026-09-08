import type {
	AgentLLMConfig,
	OpenAIChatMessage,
	OpenAIToolSchema,
} from "./types";
import type { StreamCallbacks, ChatCompletionResult } from "./llm-client";

/**
 * Anthropic Messages API support (`POST {base}/messages`).
 *
 * The agent loop's canonical representation is OpenAI-style messages, so
 * this module converts them to Anthropic's shape (system extracted, tool
 * calls as tool_use blocks, tool results as user tool_result blocks) and
 * parses Anthropic's SSE event stream back into the shared result shape.
 */

export const ANTHROPIC_VERSION = "2023-06-01";
export const ANTHROPIC_MAX_OUTPUT_TOKENS = 8192;

/**
 * Anthropic blocks browser requests unless the client opts in with this
 * header (the API key is client-side in a BYOK app either way).
 */
export const ANTHROPIC_BROWSER_ACCESS_HEADER =
	"anthropic-dangerous-direct-browser-access";
export const ANTHROPIC_BROWSER_ACCESS_VALUE = "true";

type AnthropicContentBlock =
	| { type: "text"; text: string }
	| {
			type: "tool_use";
			id: string;
			name: string;
			input: Record<string, unknown>;
	  }
	| { type: "tool_result"; tool_use_id: string; content: string };

interface AnthropicMessage {
	role: "user" | "assistant";
	content: AnthropicContentBlock[];
}

interface AnthropicTool {
	name: string;
	description: string;
	input_schema: Record<string, unknown>;
}

export interface AnthropicPayload {
	model: string;
	max_tokens: number;
	stream: true;
	system?: string;
	messages: AnthropicMessage[];
	tools?: AnthropicTool[];
}

/**
 * Converts OpenAI-style chat messages (the agent loop's internal
 * representation) to an Anthropic Messages API request body.
 *
 * Consecutive same-role turns are merged (tool results arrive as several
 * OpenAI "tool" messages but must become ONE user message of tool_result
 * blocks), and empty turns are dropped so roles stay alternating.
 */
export function toAnthropicPayload({
	messages,
	tools,
	model,
	maxTokens = ANTHROPIC_MAX_OUTPUT_TOKENS,
}: {
	messages: OpenAIChatMessage[];
	tools?: OpenAIToolSchema[];
	model: string;
	maxTokens?: number;
}): AnthropicPayload {
	const systemParts: string[] = [];
	const turns: {
		role: "user" | "assistant";
		blocks: AnthropicContentBlock[];
	}[] = [];

	const push = (role: "user" | "assistant", block: AnthropicContentBlock) => {
		const last = turns[turns.length - 1];
		if (last && last.role === role) {
			last.blocks.push(block);
		} else {
			turns.push({ role, blocks: [block] });
		}
	};

	for (const message of messages) {
		if (message.role === "system") {
			if (message.content) systemParts.push(message.content);
			continue;
		}
		if (message.role === "user") {
			if (message.content) {
				push("user", { type: "text", text: message.content });
			}
			continue;
		}
		if (message.role === "assistant") {
			if (message.content) {
				push("assistant", { type: "text", text: message.content });
			}
			for (const call of message.tool_calls ?? []) {
				let input: Record<string, unknown> = {};
				try {
					input = JSON.parse(call.function.arguments || "{}") as Record<
						string,
						unknown
					>;
				} catch {
					input = {};
				}
				push("assistant", {
					type: "tool_use",
					id: call.id,
					name: call.function.name,
					input,
				});
			}
			continue;
		}
		// OpenAI "tool" role → Anthropic user message with tool_result block.
		if (message.role === "tool") {
			push("user", {
				type: "tool_result",
				tool_use_id: message.tool_call_id ?? "",
				content: message.content ?? "",
			});
		}
	}

	const payload: AnthropicPayload = {
		model: model || "claude-sonnet-4-5",
		max_tokens: maxTokens,
		stream: true,
		messages: turns
			.filter((turn) => turn.blocks.length > 0)
			.map((turn) => ({ role: turn.role, content: turn.blocks })),
	};
	if (systemParts.length > 0) {
		payload.system = systemParts.join("\n\n");
	}
	if (tools && tools.length > 0) {
		payload.tools = tools.map((tool) => ({
			name: tool.function.name,
			description: tool.function.description,
			input_schema: tool.function.parameters,
		}));
	}
	return payload;
}

type AnthropicStreamEvent = {
	type: string;
	index?: number;
	content_block?: { type: string; id?: string; name?: string };
	delta?: {
		type?: string;
		text?: string;
		partial_json?: string;
	};
	error?: { message?: string };
};

/**
 * Streams an Anthropic Messages completion, normalizing the event stream
 * into the same result shape as the OpenAI client.
 */
export async function streamAnthropicCompletion({
	config,
	messages,
	tools,
	callbacks,
	signal,
}: {
	config: AgentLLMConfig;
	messages: OpenAIChatMessage[];
	tools?: OpenAIToolSchema[];
	callbacks: StreamCallbacks;
	signal?: AbortSignal;
}): Promise<ChatCompletionResult> {
	const baseUrl = (config.baseUrl || "https://api.anthropic.com/v1").replace(
		/\/+$/,
		"",
	);
	const payload = toAnthropicPayload({
		messages,
		tools,
		model: config.model,
	});

	const response = await fetch(`${baseUrl}/messages`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": config.apiKey,
			"anthropic-version": ANTHROPIC_VERSION,
			[ANTHROPIC_BROWSER_ACCESS_HEADER]: ANTHROPIC_BROWSER_ACCESS_VALUE,
		},
		body: JSON.stringify(payload),
		signal,
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`LLM API error (${response.status}): ${errorText}`);
	}

	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error("No response body");
	}

	const decoder = new TextDecoder();
	let contentAccumulator = "";
	const toolCalls: Array<
		| {
				id: string;
				name: string;
				arguments: string;
		  }
		| undefined
	> = [];
	let buffer = "";

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed.startsWith("data:")) continue;
				const data = trimmed.slice(5).trim();
				if (!data) continue;

				let event: AnthropicStreamEvent;
				try {
					event = JSON.parse(data) as AnthropicStreamEvent;
				} catch {
					continue;
				}

				if (event.type === "content_block_start") {
					if (event.content_block?.type === "tool_use") {
						toolCalls[event.index ?? toolCalls.length] = {
							id: event.content_block.id ?? "",
							name: event.content_block.name ?? "",
							arguments: "",
						};
					}
				} else if (event.type === "content_block_delta") {
					if (event.delta?.type === "text_delta" && event.delta.text) {
						contentAccumulator += event.delta.text;
						callbacks.onContent?.(event.delta.text);
					} else if (
						event.delta?.type === "input_json_delta" &&
						event.delta.partial_json
					) {
						const call = toolCalls[event.index ?? -1];
						if (call) call.arguments += event.delta.partial_json;
					}
				} else if (event.type === "error") {
					throw new Error(
						`LLM API error: ${event.error?.message ?? "stream error"}`,
					);
				}
			}
		}
	} finally {
		reader.releaseLock();
	}

	return {
		content: contentAccumulator,
		toolCalls: toolCalls.filter(
			(call): call is { id: string; name: string; arguments: string } =>
				Boolean(call),
		),
	};
}
