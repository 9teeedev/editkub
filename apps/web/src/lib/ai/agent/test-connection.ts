import { streamChatCompletion } from "./llm-client";
import {
	type ConnectionTestState,
	sanitizeConnectionError,
	validateAgentEndpoint,
} from "./endpoint-validation";
import type { AgentLLMConfig } from "./types";

export interface TestConnectionResult {
	state: ConnectionTestState;
	message: string;
}

/**
 * Tests connection to the configured Agent LLM endpoint.
 * - Uses the exact same streamChatCompletion client path as the Agent.
 * - Makes the smallest practical request (1 short user ping).
 * - Does not modify Agent chat history or project state.
 * - Respects cancellation AbortSignal.
 * - Sanitizes errors to prevent credential or raw body leaks.
 */
export async function testAgentConnection({
	config,
	signal,
}: {
	config: AgentLLMConfig;
	signal?: AbortSignal;
}): Promise<TestConnectionResult> {
	// 1. Validate endpoint URL before making network calls
	const validation = validateAgentEndpoint(config.baseUrl);
	if (!validation.isValid) {
		return {
			state: "invalid_endpoint",
			message: validation.error ?? "Invalid endpoint",
		};
	}

	if (!config.apiKey || !config.apiKey.trim()) {
		return {
			state: "auth_failed",
			message: "Authentication failed",
		};
	}

	try {
		await streamChatCompletion({
			config: {
				...config,
				baseUrl: validation.normalizedUrl,
			},
			messages: [
				{
					role: "user",
					content: "hi",
				},
			],
			callbacks: {},
			signal,
		});

		return {
			state: "connected",
			message: "Connected",
		};
	} catch (error) {
		if (signal?.aborted) {
			throw error;
		}
		return sanitizeConnectionError(error, config.apiKey);
	}
}
